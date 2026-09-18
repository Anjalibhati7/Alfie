/**
 * Native (iOS/Android) audio context.
 *
 * `react-native-audio-api` provides a Web Audio compatible `AudioContext` on
 * native, so the shared player in `transport.ts` runs unchanged here.
 *
 * The module is loaded through `nativeAudioApi.ts` rather than a static import,
 * because its import-time singleton throws when the native module is absent
 * (for example in Expo Go). Here that failure becomes `null`, which the caller
 * reports as "voice unavailable" instead of crashing the app.
 */

import { loadNativeAudioApi } from './nativeAudioApi';
import type { AudioContextLike } from './types';

/**
 * The device sample rate is whatever the hardware runs at (typically 48 kHz).
 * The shared player resamples to that rate, so it is not forced here.
 */
export function createAudioContext(): AudioContextLike | null {
  const api = loadNativeAudioApi();
  if (!api) return null;
  try {
    return new api.AudioContext() as unknown as AudioContextLike;
  } catch {
    return null;
  }
}

/** Native has a real audio stack, so playback works whenever the module loads. */
export function isAudioContextAvailable(): boolean {
  return loadNativeAudioApi() !== null;
}
