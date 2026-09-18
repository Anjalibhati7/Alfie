/**
 * Microphone capture and speaker playback for the live voice session.
 *
 * Audio contract with the agent service: 24000 Hz, mono, 16-bit little-endian
 * PCM, base64-encoded inside JSON events. Capture runs at whatever rate the
 * device provides and is resampled here, so the wire format never changes.
 *
 * Privacy: audio is streamed only, in memory, for the length of a session. It is
 * never written to disk, never logged, and never kept after the session ends.
 * Capture starts only when a session is explicitly started by the user.
 *
 * Platform note: this implementation uses the Web Audio API. It is the verified
 * demo path (Expo web). On a native build without a Web Audio implementation,
 * capture and playback report themselves as unsupported rather than throwing.
 */

import {
  base64Pcm16ToFloat,
  floatToBase64Pcm16,
  LinearResampler,
  WIRE_SAMPLE_RATE,
} from './pcm';

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
};

export type MicCapture = {
  stop: () => void;
};

export type PcmPlayer = {
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

type AudioContextLike = {
  sampleRate: number;
  state: string;
  currentTime: number;
  destination: unknown;
  resume: () => Promise<void>;
  createMediaStreamSource: (stream: unknown) => {
    connect: (node: unknown) => void;
  };
  createScriptProcessor: (
    bufferSize: number,
    inputChannels: number,
    outputChannels: number,
  ) => ScriptProcessorLike;
  createGain: () => GainNodeLike;
  createBuffer: (
    channels: number,
    length: number,
    rate: number,
  ) => AudioBufferLike;
  createBufferSource: () => AudioBufferSourceLike;
};

type ScriptProcessorLike = {
  onaudioprocess:
    | ((event: {
        inputBuffer: { getChannelData: (channel: number) => Float32Array };
      }) => void)
    | null;
  connect: (node: unknown) => void;
};

type GainNodeLike = {
  gain: { value: number };
  connect: (node: unknown) => void;
};
type AudioBufferLike = {
  copyToChannel: (data: Float32Array, channel: number) => void;
};
type AudioBufferSourceLike = {
  buffer: AudioBufferLike | null;
  connect: (node: unknown) => void;
  start: (when: number) => void;
  stop: () => void;
  onended: (() => void) | null;
};

const MIC_DENIED_MESSAGE =
  'Microphone access was declined, so Alfie cannot hear you. You can still read the session, and you can allow the microphone in your browser or system settings and retry.';
const MIC_UNAVAILABLE_MESSAGE =
  'No microphone was found on this device. Voice needs a microphone; the rest of the session still works.';
const CAPTURE_UNSUPPORTED_MESSAGE =
  'This build cannot capture audio. Run the web version (npm run web) for live voice.';

function scope(): Record<string, unknown> | null {
  const value: unknown = globalThis;
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readAudioContextConstructor():
  (new (options?: { sampleRate?: number }) => AudioContextLike) | null {
  const globals = scope();
  if (!globals) return null;
  const candidate = globals['AudioContext'] ?? globals['webkitAudioContext'];
  return typeof candidate === 'function'
    ? (candidate as new (options?: { sampleRate?: number }) => AudioContextLike)
    : null;
}

function readMediaDevices(): {
  getUserMedia: (constraints: unknown) => Promise<unknown>;
} | null {
  const globals = scope();
  const navigatorValue = globals?.['navigator'];
  if (typeof navigatorValue !== 'object' || navigatorValue === null)
    return null;
  const devices = (navigatorValue as Record<string, unknown>)['mediaDevices'];
  if (typeof devices !== 'object' || devices === null) return null;
  const getUserMedia = (devices as Record<string, unknown>)['getUserMedia'];
  if (typeof getUserMedia !== 'function') return null;
  return {
    getUserMedia: (
      getUserMedia as (constraints: unknown) => Promise<unknown>
    ).bind(devices),
  };
}

function createContext(): AudioContextLike | null {
  const Constructor = readAudioContextConstructor();
  if (!Constructor) return null;
  try {
    return new Constructor({ sampleRate: WIRE_SAMPLE_RATE });
  } catch {
    try {
      return new Constructor();
    } catch {
      return null;
    }
  }
}

function classifyCaptureError(error: unknown): AudioTransportError {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: unknown }).name)
      : '';
  if (
    name === 'NotAllowedError' ||
    name === 'SecurityError' ||
    name === 'PermissionDeniedError'
  ) {
    return { code: 'mic-denied', message: MIC_DENIED_MESSAGE };
  }
  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'OverconstrainedError'
  ) {
    return { code: 'mic-unavailable', message: MIC_UNAVAILABLE_MESSAGE };
  }
  return {
    code: 'mic-unavailable',
    message:
      'The microphone could not be started. Check that another app is not using it, then retry.',
  };
}

/**
 * Starts microphone capture. Rejects with an AudioTransportError when access is
 * denied or unavailable; never throws for any other reason.
 */
export async function startMicCapture(
  handlers: MicCaptureHandlers,
): Promise<MicCapture> {
  const context = createContext();
  if (!context) {
    throw {
      code: 'capture-unsupported',
      message: CAPTURE_UNSUPPORTED_MESSAGE,
    } satisfies AudioTransportError;
  }
  const devices = readMediaDevices();
  if (!devices) {
    throw {
      code: 'capture-unsupported',
      message: CAPTURE_UNSUPPORTED_MESSAGE,
    } satisfies AudioTransportError;
  }

  let stream: unknown;
  try {
    stream = await devices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (error) {
    throw classifyCaptureError(error);
  }

  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silence = context.createGain();
  silence.gain.value = 0;
  const resampler = new LinearResampler(context.sampleRate, WIRE_SAMPLE_RATE);

  let stopped = false;
  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const channel = event.inputBuffer.getChannelData(0);
    const resampled = resampler.process(channel);
    if (resampled.length === 0) return;
    handlers.onChunk(floatToBase64Pcm16(resampled));
  };

  source.connect(processor);
  processor.connect(silence);
  silence.connect(context.destination);
  void context.resume().catch(() => undefined);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      processor.onaudioprocess = null;
      const tracks = (
        stream as { getTracks?: () => { stop: () => void }[] }
      ).getTracks?.();
      tracks?.forEach((track) => track.stop());
      void context.resume().catch(() => undefined);
    },
  };
}

/**
 * Creates the speaker. The context is created eagerly so the first audio delta
 * can be scheduled without a gap, but no sound is produced until `enqueue`.
 */
export function createPcmPlayer(): PcmPlayer {
  let context: AudioContextLike | null = null;
  let resampler: LinearResampler | null = null;
  let nextStartTime = 0;
  let active: AudioBufferSourceLike[] = [];
  let disposed = false;

  function ensureContext(): boolean {
    if (context) return true;
    const created = createContext();
    if (!created) return false;
    context = created;
    resampler = new LinearResampler(WIRE_SAMPLE_RATE, created.sampleRate);
    void created.resume().catch(() => undefined);
    return true;
  }

  function schedule(base64: string): void {
    if (disposed || !context || !resampler) return;
    const samples = resampler.process(base64Pcm16ToFloat(base64));
    if (samples.length === 0) return;
    let source: AudioBufferSourceLike;
    try {
      const buffer = context.createBuffer(
        1,
        samples.length,
        context.sampleRate,
      );
      buffer.copyToChannel(samples, 0);
      source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
    } catch {
      return;
    }
    const startAt = Math.max(context.currentTime + 0.03, nextStartTime);
    nextStartTime = startAt + samples.length / context.sampleRate;
    active.push(source);
    source.onended = () => {
      active = active.filter((item) => item !== source);
    };
    try {
      source.start(startAt);
    } catch {
      active = active.filter((item) => item !== source);
    }
  }

  return {
    enqueue(base64: string) {
      if (disposed || !base64) return;
      if (!ensureContext()) {
        // Playback is unavailable; the transcript still carries the content.
        return;
      }
      schedule(base64);
    },
    flush() {
      const sources = active;
      active = [];
      nextStartTime = 0;
      for (const source of sources) {
        source.onended = null;
        try {
          source.stop();
        } catch {
          /* already finished */
        }
      }
    },
    dispose() {
      disposed = true;
      this.flush();
      const current = context;
      context = null;
      resampler = null;
      // The context is left to be collected; there is no public close() in every
      // runtime that provides this API, and stopping playback is what matters.
      void current;
    },
  };
}

/** Feature detection for the session UI. Never throws. */
export function getAudioSupport(): AudioSupport {
  const hasContext = readAudioContextConstructor() !== null;
  const hasMic = readMediaDevices() !== null;
  const capture = hasContext && hasMic;
  return {
    capture,
    playback: hasContext,
    detail: capture
      ? 'Voice input and spoken replies are available.'
      : 'Live voice needs a browser build with microphone access. You can still use the app and read the conversation.',
  };
}
