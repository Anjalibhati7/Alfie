# Alfie mobile

Expo SDK 57 + React Native + strict TypeScript + Expo Router. Routes: home (`/`), the live session (`/session`), and the Field Log (`/field-log`). Discover and Reimagine are the only modes.

Live voice now runs end to end: the microphone streams to the Alfie agent service, which proxies Boson **Higgs Realtime** for speech-to-speech conversation. The session screen shows the real `Listening` / `Thinking` / `Speaking` state, supports barge-in, and surfaces connection errors with a retry.

From the repository root, run `npm ci`, start the agent (`npm run agent`), then `npm run mobile`. Press `w` for web (the verified demo path for live voice), or `i` / `a` for a configured simulator.

- `src/app`: Router routes and root layout.
- `src/components`: shared presentation primitives.
- `src/design`: palette, semantic colors, spacing, typography, radius, and border tokens.
- `src/hooks`: platform preference hooks.
- `src/services/realtime`: voice session transport and agent URL resolution.
- `src/services/audio`: microphone capture, PCM16 conversion, resampling, and playback.
- `src/services/location`: real and simulated `LocationProvider` implementations.
- `src/services/journal`: on-device Field Log storage and theme derivation.
- `src/accessibility`: shared accessibility utilities.
- `src/state/session.tsx`: the live session store that ties the above together.

Run `npm run lint` and `npm run typecheck` at the repository root.

## Configuration

- `EXPO_PUBLIC_AGENT_URL` (optional) — base URL of the agent service. On web the app defaults to the page's host on port `8080`; on a device, set it to your machine's LAN address, e.g. `EXPO_PUBLIC_AGENT_URL=http://192.168.1.20:8080 npm run mobile`.
- No credential of any kind is read by this app. The Boson key belongs to the agent service only. Treat every `EXPO_PUBLIC_*` value as public.

## Known limitations

- Live voice uses the Web Audio API, so it is verified on the **web** target. A native development build needs a native capture/playback implementation; without one, the app reports that voice is unavailable instead of crashing.
- The spoken transcript is shown for the current session only. It is not stored and not uploaded.
- The Field Log is stored on the device via `localStorage`; where that is unavailable, entries last for the current run only and the app says so.
- A session pauses when the app leaves the foreground. The timer excludes paused time.
