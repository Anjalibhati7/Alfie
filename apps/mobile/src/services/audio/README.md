# Audio transport

Microphone capture and speaker playback for the live voice session.

## Wire format

24000 Hz, mono, 16-bit little-endian PCM, base64-encoded inside JSON events,
in both directions. Capture and playback run at the device rate and are
resampled locally by `LinearResampler`, so the wire format never changes.

## Paths

- `startMicCapture` requests the microphone just-in-time, taps raw samples with
  a `ScriptProcessorNode`, resamples, and emits base64 chunks.
- `createPcmPlayer` decodes base64 deltas, resamples, and schedules them
  gaplessly on a running cursor. `flush()` stops everything immediately, which
  is how barge-in silences Alfie.

Both use the Web Audio API, so live voice is verified on the web target. On a
runtime without Web Audio they report `capture-unsupported` /
`playback-unsupported` instead of throwing.

## Privacy

Audio is streamed only, in memory, for the length of a session. It is never
written to disk, never logged, and dropped on pause, end, and error. There is no
background listening: capture begins only when the user starts a session.

## Known limitations

- `ScriptProcessorNode` is deprecated (a console warning is expected), but it is
  universally available and survives Metro bundling, unlike AudioWorklet blobs.
- Native dev builds need their own capture implementation.
