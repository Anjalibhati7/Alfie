/**
 * Real device location for Alfie, without any new dependency.
 *
 * `expo-location` is deliberately not used. Instead this provider reads
 * `globalThis.navigator.geolocation` lazily and defensively: Expo web builds
 * and React Native's built-in polyfill expose it, and anything else degrades to
 * `unavailable`/`denied` instead of crashing.
 *
 * Privacy behaviour:
 * - Foreground-only, session-scoped. Nothing is persisted or sent anywhere.
 * - Coordinates are rounded to ~4 decimal places (~11 m) before they are
 *   exposed, and only while tracking is active.
 * - Place names are never invented: the label stays neutral and the detail
 *   says the position is approximate and unnamed.
 */

import type {
  Coordinates,
  LocationProvider,
  LocationSnapshot,
  LocationStatus,
  PlaceContext,
} from './types';

/** At most one emitted update in this window. */
const UPDATE_INTERVAL_MS = 10_000;
/** Movement below this is not worth an update (and keeps the trail tidy). */
const MOVEMENT_THRESHOLD_M = 25;
/** ~4 decimal places, i.e. roughly 11 m of precision. */
const COORDINATE_PRECISION = 10_000;
const EARTH_RADIUS_M = 6_371_000;
const DEGREES_TO_RADIANS = Math.PI / 180;
const PERMISSION_DENIED = 1;

const DENIED_MESSAGE =
  'Location permission was declined. You can keep exploring without it.';
const UNAVAILABLE_MESSAGE =
  'This device cannot share a position right now. You can keep exploring ' +
  'without it.';
const NO_FIX_MESSAGE =
  'No position came back from this device yet. You can keep exploring ' +
  'without it.';

const NEUTRAL_LABEL = 'Current area';
const APPROXIMATE_DETAIL =
  'Approximate position from this device. Place names are not available yet.';

/**
 * Coarse positional accuracy is enough for place context, faster to acquire,
 * and less revealing than a high-accuracy fix.
 */
const WATCH_OPTIONS = {
  enableHighAccuracy: false,
  maximumAge: 60_000,
  timeout: 20_000,
} as const;

type GeoWatcher = {
  watch: (
    onFix: (position: unknown) => void,
    onError: (error: unknown) => void,
  ) => number | null;
  clear: (watchId: number) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Reads the ambient Geolocation API without assuming it exists. Returns null on
 * any platform or runtime that does not provide a usable implementation.
 */
function readGeolocation(): GeoWatcher | null {
  const scope: unknown = globalThis;
  if (!isRecord(scope)) return null;
  const navigatorValue = scope['navigator'];
  if (!isRecord(navigatorValue)) return null;
  const geolocation = navigatorValue['geolocation'];
  if (!isRecord(geolocation)) return null;
  const watchPosition = geolocation['watchPosition'];
  const clearWatch = geolocation['clearWatch'];
  if (typeof watchPosition !== 'function') return null;
  if (typeof clearWatch !== 'function') return null;
  return {
    watch(onFix, onError) {
      const id: unknown = Reflect.apply(watchPosition, geolocation, [
        onFix,
        onError,
        WATCH_OPTIONS,
      ]);
      return typeof id === 'number' ? id : null;
    },
    clear(watchId) {
      Reflect.apply(clearWatch, geolocation, [watchId]);
    },
  };
}

/** True when a real foreground Geolocation implementation is reachable. */
export function isRealLocationAvailable(): boolean {
  return readGeolocation() !== null;
}

function roundCoordinate(value: number): number {
  return Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;
}

/** Narrows an unknown position object to coarse coordinates, or null. */
function readCoordinates(position: unknown): Coordinates | null {
  if (!isRecord(position)) return null;
  const coords = position['coords'];
  if (!isRecord(coords)) return null;
  const latitude = coords['latitude'];
  const longitude = coords['longitude'];
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  };
}

function isPermissionDenied(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = error['code'];
  if (code === PERMISSION_DENIED) return true;
  const message = error['message'];
  return typeof message === 'string' && /denied|permission/i.test(message);
}

/** Great-circle distance in metres; used only for change detection. */
function distanceMeters(from: Coordinates, to: Coordinates): number {
  const deltaLat = (to.latitude - from.latitude) * DEGREES_TO_RADIANS;
  const deltaLon = (to.longitude - from.longitude) * DEGREES_TO_RADIANS;
  const lat1 = from.latitude * DEGREES_TO_RADIANS;
  const lat2 = to.latitude * DEGREES_TO_RADIANS;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Contexts are shared with listeners, so keep them read-only in practice. */
function freezePlace(place: PlaceContext): PlaceContext {
  return Object.freeze(place);
}

export function createRealLocationProvider(): LocationProvider {
  let status: LocationStatus = { kind: 'idle' };
  let place: PlaceContext | null = null;
  let trail: PlaceContext[] = [];
  let lastEmittedCoordinates: Coordinates | null = null;
  let lastEmittedAt = 0;
  let tracking = false;
  let watchId: number | null = null;
  let activeGeo: GeoWatcher | null = null;
  const listeners = new Set<(snapshot: LocationSnapshot) => void>();

  function snapshot(): LocationSnapshot {
    return { status, place, trail: trail.slice() };
  }

  function emit(): void {
    const next = snapshot();
    for (const listener of Array.from(listeners)) {
      try {
        listener(next);
      } catch {
        // A misbehaving listener must never stop tracking or leak a fix.
      }
    }
  }

  function setStatus(next: LocationStatus): void {
    status = next;
    emit();
  }

  /** Idempotent teardown of the underlying watch. */
  function release(): void {
    tracking = false;
    const geo = activeGeo;
    const id = watchId;
    activeGeo = null;
    watchId = null;
    if (geo === null || id === null) return;
    try {
      geo.clear(id);
    } catch {
      // Releasing is best effort; a broken implementation must not throw.
    }
  }

  function forgetContext(): void {
    place = null;
    trail = [];
    lastEmittedCoordinates = null;
    lastEmittedAt = 0;
  }

  function handleFix(position: unknown): void {
    if (!tracking) return;
    const coordinates = readCoordinates(position);
    if (coordinates === null) return;
    const now = Date.now();
    if (lastEmittedCoordinates !== null) {
      const moved = distanceMeters(lastEmittedCoordinates, coordinates);
      if (moved < MOVEMENT_THRESHOLD_M) return;
      if (now - lastEmittedAt < UPDATE_INTERVAL_MS) return;
    }
    lastEmittedCoordinates = coordinates;
    lastEmittedAt = now;
    const next = freezePlace({
      id: 'real',
      label: NEUTRAL_LABEL,
      detail: APPROXIMATE_DETAIL,
      simulated: false,
      coarseCoordinates: coordinates,
    });
    place = next;
    trail = [...trail, next];
    status = { kind: 'active' };
    emit();
  }

  function handleError(error: unknown): void {
    if (!tracking) return;
    if (isPermissionDenied(error)) {
      release();
      forgetContext();
      setStatus({ kind: 'denied', message: DENIED_MESSAGE });
      return;
    }
    // Keep a position we already trust; otherwise report calmly and stop.
    if (lastEmittedCoordinates !== null) return;
    release();
    setStatus({ kind: 'unavailable', message: NO_FIX_MESSAGE });
  }

  async function start(): Promise<void> {
    if (status.kind === 'active' || status.kind === 'requesting') return;
    forgetContext();
    const geo = readGeolocation();
    if (geo === null) {
      setStatus({ kind: 'unavailable', message: UNAVAILABLE_MESSAGE });
      return;
    }
    activeGeo = geo;
    tracking = true;
    setStatus({ kind: 'requesting' });
    let id: number | null = null;
    try {
      id = geo.watch(handleFix, handleError);
    } catch {
      release();
      setStatus({ kind: 'unavailable', message: UNAVAILABLE_MESSAGE });
      return;
    }
    if (id === null) {
      release();
      setStatus({ kind: 'unavailable', message: UNAVAILABLE_MESSAGE });
      return;
    }
    watchId = id;
  }

  function stop(): void {
    release();
    const hadContext = place !== null || trail.length > 0;
    forgetContext();
    const changed = status.kind !== 'stopped' || hadContext;
    status = { kind: 'stopped' };
    if (changed) emit();
  }

  function statusLabel(): string {
    switch (status.kind) {
      case 'idle':
        return 'Location not started';
      case 'requesting':
        return 'Requesting location permission';
      case 'active':
        return 'Approximate location active';
      case 'denied':
        return 'Location permission declined';
      case 'unavailable':
        return 'Location unavailable';
      case 'stopped':
        return 'Location stopped';
    }
  }

  return {
    id: 'real',
    simulated: false,
    start,
    stop,
    current: () => place,
    trail: () => trail.slice(),
    status: () => status,
    statusLabel,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
