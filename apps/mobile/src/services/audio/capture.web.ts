/**
 * Web microphone capture, for the Expo web build and the in-browser demo.
 *
 * Uses `getUserMedia` plus a `ScriptProcessorNode`. The processor is deprecated
 * but universally available and survives Metro bundling, unlike AudioWorklet,
 * which needs a separate worklet bundle.
 *
 * Privacy: samples are converted to base64 and handed straight to the socket.
 * Nothing is buffered beyond the current callback, and no file is written.
 */

import {
  floatToBase64Pcm16,
  levelOf,
  LinearResampler,
  WIRE_SAMPLE_RATE,
} from './pcm';
import {
  CAPTURE_UNSUPPORTED_MESSAGE,
  MIC_DENIED_MESSAGE,
  MIC_UNAVAILABLE_MESSAGE,
  type AudioTransportError,
  type MicCapture,
  type MicCaptureHandlers,
} from './types';
import { createAudioContext } from './context';
import { createLimitedDiag, voiceDiag } from './diagnostics';

type ScriptProcessorLike = {
  onaudioprocess:
    | ((event: {
        inputBuffer: { getChannelData: (channel: number) => Float32Array };
      }) => void)
    | null;
  connect: (node: unknown) => void;
};

type StreamLike = { getTracks?: () => { stop: () => void }[] };

function readMediaDevices(): {
  getUserMedia: (constraints: unknown) => Promise<unknown>;
} | null {
  const scope: unknown = globalThis;
  if (typeof scope !== 'object' || scope === null) return null;
  const navigatorValue = (scope as Record<string, unknown>)['navigator'];
  if (typeof navigatorValue !== 'object' || navigatorValue === null)
    return null;
  const devices = (navigatorValue as Record<string, unknown>)['mediaDevices'];
  if (typeof devices !== 'object' || devices === null) return null;
  const getUserMedia = (devices as Record<string, unknown>)['getUserMedia'];
  if (typeof getUserMedia !== 'function') return null;
  return {
    getUserMedia: (getUserMedia as (c: unknown) => Promise<unknown>).bind(
      devices,
    ),
  };
}

/** Real channel count of the microphone track, for the diagnostics. */
function trackChannelCount(stream: unknown): number {
  const tracks = (
    stream as { getAudioTracks?: () => unknown[] }
  )?.getAudioTracks?.();
  const settings = (
    tracks?.[0] as { getSettings?: () => { channelCount?: number } } | undefined
  )?.getSettings?.();
  return settings?.channelCount ?? 0;
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

export async function startPlatformCapture(
  handlers: MicCaptureHandlers,
): Promise<MicCapture> {
  const context = createAudioContext();
  const devices = readMediaDevices();
  if (!context || !devices) {
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

  // Not part of the shared AudioContextLike surface, so it is read here.
  const graph = context as unknown as {
    createMediaStreamSource: (s: unknown) => { connect: (n: unknown) => void };
    createScriptProcessor: (
      bufferSize: number,
      inputChannels: number,
      outputChannels: number,
    ) => ScriptProcessorLike;
    createGain: () => {
      gain: { value: number };
      connect: (n: unknown) => void;
    };
  };

  const source = graph.createMediaStreamSource(stream);
  const processor = graph.createScriptProcessor(4096, 1, 1);
  const silence = graph.createGain();
  silence.gain.value = 0;
  const resampler = new LinearResampler(context.sampleRate, WIRE_SAMPLE_RATE);

  voiceDiag('capture.started', {
    contextSampleRate: context.sampleRate,
    resampling: !resampler.passthrough,
    outputRate: WIRE_SAMPLE_RATE,
    processorBufferSize: 4096,
    contextState: context.state,
    trackChannels: trackChannelCount(stream),
  });
  const logChunk = createLimitedDiag('capture.chunk', 5);

  let stopped = false;
  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const channel = event.inputBuffer.getChannelData(0);
    // Report loudness before resampling: this drives the on-screen meter that
    // proves the browser is actually receiving the microphone.
    if (handlers.onLevel) handlers.onLevel(levelOf(channel));
    const resampled = resampler.process(channel);
    if (resampled.length === 0) return;
    const base64 = floatToBase64Pcm16(resampled);
    logChunk({
      browserContextRate: context.sampleRate,
      sentRate: WIRE_SAMPLE_RATE,
      inputSamples: channel.length,
      outputSamples: resampled.length,
      base64Chars: base64.length,
      pcmBytes: resampled.length * 2,
      // levelOf amplifies by 4 for the meter; this is the raw figure.
      rms: Number((levelOf(channel) / 4).toFixed(4)),
    });
    handlers.onChunk(base64);
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
      (stream as StreamLike).getTracks?.().forEach((track) => track.stop());
    },
  };
}

export function isNativeCaptureAvailable(): boolean {
  return readMediaDevices() !== null;
}
