/**
 * Entry point for Alfie's location abstraction.
 *
 * Two interchangeable providers share one contract, and the demo provider is
 * always available as a labelled fallback. Neither provider persists anything,
 * sends anything over the network, or keeps a background/continuous history.
 */

import { createDemoLocationProvider } from './demo';
import { createRealLocationProvider, isRealLocationAvailable } from './real';
import type { LocationProvider } from './types';

export type {
  Coordinates,
  LocationProvider,
  LocationSnapshot,
  LocationStatus,
  PlaceContext,
} from './types';
export { createDemoLocationProvider } from './demo';
export { createRealLocationProvider, isRealLocationAvailable } from './real';

/**
 * Picks a provider: the simulated one when the caller asks for it (demos,
 * previews, tests) or when this runtime has no usable foreground Geolocation
 * implementation, so a live session never loses place context merely because
 * the platform cannot supply one.
 */
export function resolveLocationProvider(preferDemo: boolean): LocationProvider {
  if (preferDemo || !isRealLocationAvailable()) {
    return createDemoLocationProvider();
  }
  return createRealLocationProvider();
}
