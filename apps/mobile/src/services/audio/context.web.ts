/**
 * Web audio context.
 *
 * Used for the Expo web build and for any runtime that exposes the browser Web
 * Audio API. Metro resolves this file instead of `context.native.ts` on web, so
 * the native audio module never enters the web bundle.
 */

import type { AudioContextLike } from './types';

type AudioContextConstructor = new (options?: {
  sampleRate?: number;
}) => AudioContextLike;

function readConstructor(): AudioContextConstructor | null {
  const scope: unknown = globalThis;
  if (typeof scope !== 'object' || scope === null) return null;
  const record = scope as Record<string, unknown>;
  const candidate = record['AudioContext'] ?? record['webkitAudioContext'];
  return typeof candidate === 'function'
    ? (candidate as AudioContextConstructor)
    : null;
}

/**
 * Prefers a 24 kHz context so playback needs no resampling, falling back to the
 * device rate where a custom rate is refused.
 */
export function createAudioContext(): AudioContextLike | null {
  const Constructor = readConstructor();
  if (!Constructor) return null;
  try {
    return new Constructor({ sampleRate: 24_000 });
  } catch {
    try {
      return new Constructor();
    } catch {
      return null;
    }
  }
}

export function isAudioContextAvailable(): boolean {
  return readConstructor() !== null;
}
