/**
 * Simulated location for indoor demos, previews, and tests.
 *
 * The route is a small fictional-but-plausible loop in a generic urban park
 * near the Embarcadero in San Francisco. The coordinates are synthetic and the
 * labels are descriptive rather than real place names, so nothing here should
 * be presented as a real venue. Every context carries `simulated: true` and the
 * UI MUST label it as simulated.
 *
 * Privacy behaviour: nothing leaves the device, nothing is persisted, and all
 * state is in memory. The trail is cleared on `start()` and on `stop()`.
 */

import type {
  Coordinates,
  LocationProvider,
  LocationSnapshot,
  LocationStatus,
  PlaceContext,
} from './types';

/** One simulated step every eight seconds, then the loop restarts. */
const STEP_INTERVAL_MS = 8_000;

type DemoPoint = {
  label: string;
  detail: string;
  coordinates: Coordinates;
};

/**
 * Seven points spaced roughly 48-69 m apart, forming a closed loop of about
 * 430 m. Coordinates are already rounded to ~4 decimal places.
 */
const DEMO_ROUTE: readonly DemoPoint[] = [
  {
    label: 'Bench under the plane trees',
    detail: 'Low branches and dappled shade, with a gravel path alongside.',
    coordinates: { latitude: 37.7955, longitude: -122.3937 },
  },
  {
    label: 'North edge of the plaza',
    detail: 'Open paving on one side, a trimmed hedge on the other.',
    coordinates: { latitude: 37.7959, longitude: -122.3935 },
  },
  {
    label: 'Wall with the tile mural',
    detail: 'A long wall of painted tiles beside a narrow walkway.',
    coordinates: { latitude: 37.7962, longitude: -122.3929 },
  },
  {
    label: 'Shaded side of the footbridge',
    detail: 'A footbridge passes overhead; this stretch stays in shadow.',
    coordinates: { latitude: 37.796, longitude: -122.3922 },
  },
  {
    label: 'Small garden bed',
    detail: 'A planted bed with low stone edging and a bare-earth border.',
    coordinates: { latitude: 37.7954, longitude: -122.392 },
  },
  {
    label: 'Steps by the water',
    detail: 'Wide shallow steps leading down toward the water.',
    coordinates: { latitude: 37.795, longitude: -122.3925 },
  },
  {
    label: 'Paved path beside the lawn',
    detail: 'A paved path running along the edge of an open lawn.',
    coordinates: { latitude: 37.7952, longitude: -122.3931 },
  },
];

/** Simulated movement, so every point reports the same coarse activity. */
const DEMO_ACTIVITY = 'walking' as const;

/**
 * The area the simulated route sits in. These coordinates are in the
 * Embarcadero area of San Francisco, so naming it is honest for the demo; the
 * route itself is invented and every point is labelled as simulated.
 */
const DEMO_AREA = 'The Embarcadero';

function pointContext(index: number, point: DemoPoint): PlaceContext {
  return Object.freeze({
    id: `demo-${String(index + 1)}`,
    label: point.label,
    detail: point.detail,
    area: DEMO_AREA,
    activity: DEMO_ACTIVITY,
    simulated: true,
    coarseCoordinates: point.coordinates,
  });
}

export function createDemoLocationProvider(): LocationProvider {
  let status: LocationStatus = { kind: 'idle' };
  let place: PlaceContext | null = null;
  let trail: PlaceContext[] = [];
  let index = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
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
        // A misbehaving listener must never stop the demo timer.
      }
    }
  }

  function publish(next: PlaceContext): void {
    place = next;
    trail = [...trail, next];
    status = { kind: 'active' };
    emit();
  }

  function clearTimer(): void {
    running = false;
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  }

  function forgetContext(): void {
    place = null;
    trail = [];
    index = 0;
  }

  /** Timer-driven only; deliberately not part of the public API. */
  function advance(): void {
    if (!running) return;
    index = (index + 1) % DEMO_ROUTE.length;
    const point = DEMO_ROUTE[index];
    if (!point) return;
    publish(pointContext(index, point));
  }

  async function start(): Promise<void> {
    if (running) return;
    const first = DEMO_ROUTE[0];
    if (!first) {
      status = {
        kind: 'unavailable',
        message: 'The simulated route is empty. You can keep exploring.',
      };
      emit();
      return;
    }
    clearTimer();
    forgetContext();
    running = true;
    publish(pointContext(0, first));
    timer = setInterval(advance, STEP_INTERVAL_MS);
  }

  function stop(): void {
    clearTimer();
    const hadContext = place !== null || trail.length > 0;
    forgetContext();
    const changed = status.kind !== 'stopped' || hadContext;
    status = { kind: 'stopped' };
    if (changed) emit();
  }

  function statusLabel(): string {
    switch (status.kind) {
      case 'idle':
        return 'Simulated location not started';
      case 'requesting':
        return 'Starting simulated location';
      case 'active':
        return 'Simulated location active';
      case 'denied':
      case 'unavailable':
        return 'Simulated location unavailable';
      case 'stopped':
        return 'Simulated location stopped';
    }
  }

  return {
    id: 'demo',
    simulated: true,
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
