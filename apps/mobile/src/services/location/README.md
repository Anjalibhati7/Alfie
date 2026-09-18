# Location service

Two interchangeable `LocationProvider` implementations behind one contract
(`types.ts`). Nothing here persists data, logs coordinates, or performs network
requests, and no new dependency is introduced.

## Providers

| Provider                       | `id`   | `simulated` | Source                             |
| ------------------------------ | ------ | ----------- | ---------------------------------- |
| `createRealLocationProvider()` | `real` | `false`     | `globalThis.navigator.geolocation` |
| `createDemoLocationProvider()` | `demo` | `true`      | Seven fixed simulated points       |

`resolveLocationProvider(preferDemo)` returns the demo provider when
`preferDemo` is true or when `isRealLocationAvailable()` is false, so a live
session always has place context available.

### Real provider

`expo-location` is not installed and is intentionally not used. The provider
reads `navigator.geolocation` lazily on every `start()` and defensively: if the
object, `watchPosition`, or `clearWatch` is missing or not a function, the
result is a calm `unavailable` status rather than an exception. This works in
Expo web builds and through React Native's built-in polyfill; anywhere else it
degrades gracefully.

- Foreground-only, session-scoped `watchPosition` with coarse accuracy
  (`enableHighAccuracy: false`, 60 s `maximumAge`, 20 s `timeout`).
- Updates are throttled to at most one every 10 s **and** only when the user has
  moved more than 25 m from the last emitted point.
- Permission denial (geolocation error code 1, or a message mentioning
  "denied"/"permission") reports `{ kind: 'denied' }` with a plain-language
  message and never throws.
- Other errors are ignored while a trusted fix exists; with no fix yet they
  report `{ kind: 'unavailable' }` and release the watch. Calling `start()`
  again retries.
- The label is always the neutral `"Current area"`. Place names are never
  invented; the detail states the position is approximate and unnamed. No
  activity hint is emitted, because the device cannot tell walking from riding.
- `stop()` clears the watch, drops the latest context **and** clears the trail.

### Demo provider

Simulates a walk for indoor demos, previews, and tests. `start()` emits a
context immediately and then advances one point every 8 seconds, looping back to
the first point after the last. There is no public `advance()`; progression is
timer-only. Every context has `simulated: true`, so the UI must label it as
simulated.

## How the demo route is chosen

The route is a fictional-but-plausible walk near the Embarcadero in San
Francisco, fixed in `demo.ts` as a compile-time constant:

| #        | Label                         | Latitude | Longitude |
| -------- | ----------------------------- | -------- | --------- |
| `demo-1` | Bench under the plane trees   | 37.7955  | -122.3937 |
| `demo-2` | North edge of the plaza       | 37.7959  | -122.3935 |
| `demo-3` | Wall with the tile mural      | 37.7962  | -122.3929 |
| `demo-4` | Shaded side of the footbridge | 37.7960  | -122.3922 |
| `demo-5` | Small garden bed              | 37.7954  | -122.3920 |
| `demo-6` | Steps by the water            | 37.7950  | -122.3925 |
| `demo-7` | Paved path beside the lawn    | 37.7952  | -122.3931 |

The starting point is an arbitrary anchor around 37.7955, -122.3937; the
remaining points were placed to form a closed loop of roughly 430 m with
consecutive gaps between 48 m and 69 m, so timer-driven steps look like real
walking distance rather than teleporting. Labels are descriptive of local
features (bench, plaza edge, footbridge, water steps) instead of naming real
venues, because the coordinates are simulated and any real-world match would be
coincidental.

## Privacy rules encoded here

- Precise coordinates never leave a provider. Fixes are rounded to ~4 decimal
  places (about 11 m) and exposed only as `coarseCoordinates`.
- Coordinates and the trail exist only while tracking is active. `start()`
  clears the trail, and `stop()`, denial, or an unavailable runtime clears both
  the latest context and the trail, so no route history outlives a session.
- The trail is in-memory only. Nothing is written to disk, AsyncStorage, or any
  backend, and no coordinate is ever logged.
- Simulated context is always flagged with `simulated: true`; consumers must
  label it as simulated in the UI.

## Status labels

`statusLabel()` feeds an `aria-live`/`accessibilityLiveRegion` announcement, so
each string is short, calm, and jargon-free, for example
`"Simulated location active"`, `"Approximate location active"`,
`"Location permission declined"`, `"Location stopped"`. Statuses follow the
session lifecycle: `idle` → `requesting` → `active`, or `denied` /
`unavailable`, and `stopped` after `stop()`.

## Known limitations

- Native (iOS/Android) permission prompts are not requested here: without
  `expo-location` the platform grant has to be handled by the host app or the
  native Geolocation module, which reports `denied` until a grant exists.
- Web positioning needs a secure context (HTTPS or localhost).
- The real provider emits no place names and no activity hint; reverse
  geocoding is out of scope.
- The demo trail grows by one entry every 8 seconds for as long as the session
  runs; it is never truncated, only cleared on `start()`/`stop()`.
