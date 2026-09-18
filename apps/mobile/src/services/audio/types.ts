/**
 * Shared audio transport contract.
 *
 * The public surface lives in `transport.ts`. These types are split out so the
 * native and web implementations can share one definition without either
 * importing the other's platform module.
 */

export type AudioTransportErrorCode =
  | 'mic-denied'
  | 'mic-unavailable'
  | 'capture-unsupported'
  | 'playback-unsupported';

export type AudioTransportError = {
  code: AudioTransportErrorCode;
  message: string;
};

export type MicCaptureHandlers = {
  /** base64 PCM16 LE mono @24000Hz, ready for input_audio_buffer.append. */
  onChunk: (base64Pcm16: string) => void;
  onError: (error: AudioTransportError) => void;
  /**
   * Input loudness, 0..1, for the on-screen microphone meter. This is the only
   * signal that proves the browser is actually receiving the user's voice;
   * without it a working socket and a dead microphone look identical.
   */
  onLevel?: (level: number) => void;
};

export type MicCapture = {
  stop: () => void;
};

export type PcmPlayer = {
  /** Play a base64 PCM16 LE mono @24000Hz chunk, gaplessly and in order. */
  enqueue: (base64Pcm16: string) => void;
  /** Stop playback immediately and drop queued audio. Used for barge-in. */
  flush: () => void;
  dispose: () => void;
};

export type AudioSupport = {
  capture: boolean;
  playback: boolean;
  detail: string;
};

/**
 * The subset of the Web Audio API this app uses.
 *
 * Both the platform `AudioContext` and the `react-native-audio-api` one satisfy
 * this shape, which is why the player is written once for both.
 */
export type AudioBufferLike = {
  copyToChannel: (source: Float32Array, channelNumber: number) => void;
};

export type AudioBufferSourceLike = {
  buffer: AudioBufferLike | null;
  connect: (destination: unknown) => void;
  start: (when: number) => void;
  stop: () => void;
};

export type AudioContextLike = {
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state: string;
  resume: () => Promise<void>;
  close?: () => Promise<void>;
  createBuffer: (
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ) => AudioBufferLike;
  createBufferSource: () => AudioBufferSourceLike;
};

/** User-facing copy for a declined or missing microphone. */
export const MIC_DENIED_MESSAGE =
  'Microphone access was declined, so Alfie cannot hear you. You can allow the microphone in your device settings and retry.';

export const MIC_UNAVAILABLE_MESSAGE =
  'No microphone was available. Voice needs a microphone; you can still read the session on screen.';

export const CAPTURE_UNSUPPORTED_MESSAGE =
  'This device cannot capture audio, so live voice is unavailable. Everything else still works.';

export const PLAYBACK_UNSUPPORTED_MESSAGE =
  'This device cannot play audio, so you will not hear Alfie. The conversation still appears on screen.';
