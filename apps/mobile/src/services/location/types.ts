/**
 * Public contracts for Alfie's location providers.
 *
 * Everything crossing this boundary is already privacy-minimised: only coarse
 * coordinates may leave a provider, and only while tracking is active. These
 * types are pure declarations so both providers and the UI can depend on them
 * without pulling in an implementation.
 */

export type Coordinates = { latitude: number; longitude: number };

/** Coarse, privacy-minimised place context actually shared with the AI. */
export type PlaceContext = {
  /** Stable id for change detection, e.g. "demo-3" or "real". */
  id: string;
  /**
   * Human label of where the user is, e.g. "Courtyard bench".
   * Never a raw coordinate.
   */
  label: string;
  /** Optional short "what is around" line. Must be honest and non-invented. */
  detail?: string;
  /**
   * Optional name of the wider area, e.g. "The Embarcadero". Only ever set by a
   * provider that can honestly know it; the real provider leaves this unset
   * rather than inventing a neighbourhood name from coordinates.
   */
  area?: string;
  /** Coarse activity/state hint, e.g. "walking". */
  activity?: 'still' | 'walking';
  /**
   * True only for the simulated provider.
   * UI MUST label simulated context as simulated.
   */
  simulated: boolean;
  /**
   * Rounded coordinates (~4 decimal places max) when the user opted in;
   * omitted otherwise.
   */
  coarseCoordinates?: Coordinates;
};

export type LocationStatus =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'active' }
  | { kind: 'denied'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'stopped' };

export type LocationSnapshot = {
  status: LocationStatus;
  place: PlaceContext | null;
  trail: PlaceContext[];
};

export type LocationProvider = {
  readonly id: 'real' | 'demo';
  readonly simulated: boolean;
  /**
   * Ask for permission just-in-time and begin foreground-only tracking.
   * Never throws.
   */
  start: () => Promise<void>;
  /** Stop tracking and release resources. Idempotent. */
  stop: () => void;
  /** Latest context, or null before the first fix. */
  current: () => PlaceContext | null;
  /**
   * The ordered trail of contexts since start (used for the Field Log route
   * points). Becomes an array copy.
   */
  trail: () => PlaceContext[];
  status: () => LocationStatus;
  /** Short plain-language status suitable for a live region. */
  statusLabel: () => string;
  subscribe: (listener: (snapshot: LocationSnapshot) => void) => () => void;
};
