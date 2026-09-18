/**
 * Guarded loader for `react-native-audio-api`.
 *
 * The package creates a native-module singleton at import time and *throws*
 * from its constructor when the native module is missing (`Failed to install
 * react-native-audio-api: The native module could not be found.`). A static
 * `import` would therefore take the whole app down at startup — for example in
 * Expo Go, or any JS-only runtime — instead of degrading to "voice unavailable".
 *
 * So the module is required lazily, inside a try/catch, and the failure is
 * remembered. Nothing outside the voice path is affected by it.
 *
 * This file is only reachable from `capture.native.ts` / `context.native.ts`, so
 * it never enters the web bundle.
 */

export type NativeAudioApi = typeof import('react-native-audio-api');

/** `undefined` = not loaded yet, `null` = unavailable on this runtime. */
let cached: NativeAudioApi | null | undefined;

export function loadNativeAudioApi(): NativeAudioApi | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-audio-api') as NativeAudioApi;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when the native audio module is actually installed and usable. */
export function hasNativeAudioApi(): boolean {
  return loadNativeAudioApi() !== null;
}
