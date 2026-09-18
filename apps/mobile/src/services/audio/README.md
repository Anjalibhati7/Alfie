# Audio transport

Microphone capture and speaker playback for the live voice session.

## Wire format

24000 Hz, mono, 16-bit little-endian PCM, base64-encoded inside JSON events, in
both directions. Capture runs at the device rate and is resampled to 24 kHz on
the way out; playback is resampled from 24 kHz to the context rate. `pcm.ts`
holds the conversion and a streaming `LinearResampler` that carries state
between chunks so there are no per-chunk artefacts.

## Two capture paths, one public API

| Platform      | File                | Mechanism                                    |
| ------------- | ------------------- | -------------------------------------------- |
| iOS / Android | `capture.native.ts` | `react-native-audio-api` `AudioRecorder`     |
| Web           | `capture.web.ts`    | `getUserMedia` + `ScriptProcessorNode`       |

Metro picks one at build time via `.native` / `.web` resolution, so neither
platform bundles the other's code. `tsconfig.json` sets `moduleSuffixes` so
TypeScript resolves and typechecks the same way. This is verified, not assumed:
the iOS Hermes bundle contains the `AudioRecorder` API and no web capture code,
and the web bundle is the reverse.

Playback is a single shared implementation in `transport.ts`, because both
platforms provide a Web Audio compatible `AudioContext`:

- `context.native.ts` — the native `AudioContext` from `react-native-audio-api`.
- `context.web.ts` — the browser `AudioContext`.

## Native specifics

- **The native module is loaded lazily**, through `nativeAudioApi.ts`. The
  package creates a native-module singleton at import time and throws from its
  constructor when the native module is missing. A static import would take the
  whole app down at startup; the guarded `require` turns that into an ordinary
  "voice unavailable" state instead.
- **File output is explicitly disabled** on the recorder (`disableFileOutput`),
  so raw microphone audio cannot be written to disk even by accident.
- The recorded sample rate can differ from the requested one, so the resampler is
  built from the first buffer's actual `sampleRate`.
- The audio session is activated on start and **deactivated on stop**, so capture
  never outlives a session.
- `startMicCapture` maps a declined permission to `mic-denied` and a missing
  input to `mic-unavailable`, both with plain-language messages.

## Barge-in

`createPcmPlayer().flush()` stops every scheduled source immediately and resets
the playhead. That is what silences Alfie the moment the model is interrupted.
Sources are pruned by scheduled end time rather than a completion callback,
because that callback is named `onEnded` on native and `onended` on web.

## Privacy

Audio is streamed only, in memory, for the length of a session. It is never
written to disk, never logged, and dropped on pause, end, and error. There is no
background listening: capture begins only when the user starts a session, and the
Expo plugin config sets `iosBackgroundMode: false` and
`androidForegroundService: false` so no background audio capability is granted.

## Known limitations

- `ScriptProcessorNode` on the web path is deprecated (a console warning is
  expected), but it is universally available and survives Metro bundling, unlike
  AudioWorklet, which needs a separate worklet bundle.
- The native path requires a **development build** (`npx expo run:ios` /
  `run:android`, or an EAS dev client). It does not work in Expo Go; there the
  app reports voice as unavailable rather than crashing.
- The native path is verified at bundle level and by API contract against the
  installed package. It has **not** been exercised on a physical device from this
  environment.
