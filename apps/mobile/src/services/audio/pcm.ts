/**
 * PCM helpers for the realtime voice stream.
 *
 * Wire format for both directions: 24000 Hz, mono, 16-bit little-endian PCM,
 * base64-encoded inside JSON events. Capture and playback run at whatever rate
 * the audio device gives us, so both sides resample locally.
 *
 * Nothing in this file logs, stores, or uploads audio.
 */

import { fromByteArray, toByteArray } from 'base64-js';

export const WIRE_SAMPLE_RATE = 24_000;

/** Float32 [-1, 1] -> Int16 little-endian, base64. */
export function floatToBase64Pcm16(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    const int = Math.round(value);
    bytes[index * 2] = int & 0xff;
    bytes[index * 2 + 1] = (int >> 8) & 0xff;
  }
  return fromByteArray(bytes);
}

/** Base64 Int16 little-endian -> Float32 [-1, 1]. */
export function base64Pcm16ToFloat(base64: string): Float32Array {
  const bytes = toByteArray(base64);
  const count = Math.floor(bytes.length / 2);
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const low = bytes[index * 2] ?? 0;
    const high = bytes[index * 2 + 1] ?? 0;
    const int = (high << 8) | low;
    const signed = int >= 0x8000 ? int - 0x10000 : int;
    samples[index] = signed / 0x8000;
  }
  return samples;
}

/**
 * Streaming linear resampler. Keeping the fractional read position and the last
 * input sample between calls avoids the click that per-chunk resampling causes.
 */
export class LinearResampler {
  private position = 0;
  private previous = 0;
  private primed = false;

  constructor(
    private readonly inputRate: number,
    private readonly outputRate: number,
  ) {}

  get passthrough(): boolean {
    return this.inputRate === this.outputRate;
  }

  process(input: Float32Array): Float32Array {
    if (this.passthrough) return input;
    if (input.length === 0) return input;

    const ratio = this.inputRate / this.outputRate;
    // The virtual input starts one sample before this chunk so interpolation
    // across the chunk boundary stays continuous.
    const start = this.primed ? -1 : 0;
    const available = input.length + (this.primed ? 1 : 0);
    const outputLength = Math.max(
      0,
      Math.floor((available - start) / ratio) - 1,
    );
    const output = new Float32Array(outputLength);

    let position = start;
    for (let index = 0; index < outputLength; index += 1) {
      const base = Math.floor(position);
      const fraction = position - base;
      const left = this.sample(input, base);
      const right = this.sample(input, base + 1);
      output[index] = left + (right - left) * fraction;
      position += ratio;
    }

    this.position = position;
    this.previous = input[input.length - 1] ?? 0;
    this.primed = true;
    return output;
  }

  /** Index -1 refers to the carried sample from the previous chunk. */
  private sample(input: Float32Array, index: number): number {
    if (index < 0) return this.previous;
    if (index >= input.length) return input[input.length - 1] ?? 0;
    return input[index] ?? 0;
  }
}

/**
 * Loudness of a buffer, 0..1, for the on-screen microphone meter.
 *
 * Uses RMS scaled for visibility: normal speech sits around 0.05-0.2 RMS, which
 * would barely move a raw 0..1 bar, so it is amplified and clamped.
 */
export function levelOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i] ?? 0;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, rms * 4);
}
