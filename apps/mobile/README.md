# Alfie mobile

Expo SDK 57 + React Native + strict TypeScript + Expo Router. Routes: home (`/`), the live session (`/session`), and the Field Log (`/field-log`). Discover and Reimagine are the only modes.

Live voice runs end to end on **both native and web**: the microphone streams to the Alfie agent service, which proxies Boson **Higgs Realtime** for speech-to-speech conversation. The session screen shows the real `Listening` / `Thinking` / `Speaking` state, supports barge-in, and surfaces connection errors with a retry.

Native (iOS/Android) is the primary target and uses `react-native-audio-api`; web uses `getUserMedia` and is the fallback. Metro picks one at build time.

From the repository root, run `npm ci`, start the agent (`npm run agent`), then:

```sh
# Native, the primary target. Requires a development build, NOT Expo Go.
npm run mobile
#   then press i or a, or build a dev client:
npx expo run:ios      # or: npx expo run:android

# Web fallback
npm run mobile        # then press w
```

Live voice needs a development build because `react-native-audio-api` is a native module. In Expo Go the app still runs and reports voice as unavailable instead of crashing.

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

- Live voice has two capture paths selected at build time: native (`react-native-audio-api`) and web (`getUserMedia`). The native path requires a development build; it is verified at bundle level but has not been run on a physical device from this environment.
- The spoken transcript is shown for the current session only. It is not stored and not uploaded.
- The Field Log is device-local on both platforms: a JSON file in the app document directory on native (`expo-file-system`), and `localStorage` on web. Where neither works, entries last for the current run only and the app says so rather than implying a save.
- A session pauses when the app leaves the foreground. The timer excludes paused time.
