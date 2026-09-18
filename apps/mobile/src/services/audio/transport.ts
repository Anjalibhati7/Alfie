/**
 * Microphone capture and speaker playback for the live voice session.
 *
 * Audio contract with the agent service: 24000 Hz, mono, 16-bit little-endian
 * PCM, base64-encoded inside JSON events.
 *
 * Two capture paths, one public API:
 * - Native iOS/Android: `audio/capture.native.ts` uses `react-native-audio-api`
 *   and the device microphone. This is the primary path for the real app.
 * - Web: `audio/capture.web.ts` uses `getUserMedia`.
 * Metro picks one at build time, so neither platform bundles the other's code.
 *
 * Playback is identical on both, because both platforms provide a Web Audio
 * compatible `AudioContext` (see `audio/context.native.ts` / `.web.ts`).
 *
 * Privacy: audio is streamed only, in memory, for the length of a session. It is
 * never written to disk, never logged, and never kept after the session ends.
 * Capture starts only when the user explicitly starts a session.
 */

import { isNativeCaptureAvailable, startPlatformCapture } from './capture';
import { createAudioContext, isAudioContextAvailable } from './context';
import {
  base64Pcm16ToFloat,
  floatToBase64Pcm16,
  LinearResampler,
  WIRE_SAMPLE_RATE,
} from './pcm';
import type {
  AudioSupport,
  MicCapture,
  MicCaptureHandlers,
  PcmPlayer,
} from './types';

export type {
  AudioSupport,
  AudioTransportError,
  AudioTransportErrorCode,
  MicCapture,
  MicCaptureHandlers,
  PcmPlayer,
} from './types';

/**
 * Starts microphone capture on the current platform, converting to the wire
 * format. Rejects with an AudioTransportError when access is denied or
 * unavailable; never throws for any other reason.
 */
export async function startMicCapture(
  handlers: MicCaptureHandlers,
): Promise<MicCapture> {
  return startPlatformCapture(handlers);
}

/** How much audio may sit scheduled ahead of the playhead, in seconds. */
const MAX_SCHEDULE_AHEAD_S = 1;
/** Small lead so the first chunk starts cleanly rather than mid-callback. */
const START_LEAD_S = 0.03;

/**
 * Creates the speaker. The context is created eagerly so the first audio delta
 * can be scheduled without a gap, but nothing is audible until `enqueue`.
 */
export function createPcmPlayer(): PcmPlayer {
  const context = createAudioContext();
  const resampler = context
    ? new LinearResampler(WIRE_SAMPLE_RATE, context.sampleRate)
    : null;

  /**
   * Scheduled sources with the time each finishes. The completion callback is
   * named differently on native and web, so sources are pruned by time instead.
   */
  let scheduled: { source: { stop: () => void }; endsAt: number }[] = [];
  let nextStartTime = 0;
  let disposed = false;

  function prune(now: number): void {
    scheduled = scheduled.filter((item) => item.endsAt > now);
  }

  function schedule(base64: string): void {
    if (!context || !resampler) return;
    const samples = resampler.process(base64Pcm16ToFloat(base64));
    if (samples.length === 0) return;

    let source: ReturnType<typeof context.createBufferSource>;
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

    const now = context.currentTime;
    prune(now);
    // If audio is already queued past the allowed window, start as soon as we
    // can rather than falling further behind.
    const startAt = Math.max(
      now + START_LEAD_S,
      Math.min(nextStartTime, now + MAX_SCHEDULE_AHEAD_S),
    );
    const duration = samples.length / context.sampleRate;
    nextStartTime = startAt + duration;
    scheduled.push({ source, endsAt: nextStartTime });

    try {
      source.start(startAt);
    } catch {
      scheduled = scheduled.filter((item) => item.source !== source);
    }
  }

  return {
    enqueue(base64: string) {
      if (disposed || !base64 || !context) return;
      if (context.state === 'suspended') {
        void context.resume().catch(() => undefined);
      }
      schedule(base64);
    },
    flush() {
      const sources = scheduled;
      scheduled = [];
      nextStartTime = 0;
      for (const item of sources) {
        try {
          item.source.stop();
        } catch {
          /* already finished */
        }
      }
    },
    dispose() {
      disposed = true;
      this.flush();
      void context?.close?.().catch(() => undefined);
    },
  };
}

/** Feature detection for the session UI. Never throws. */
export function getAudioSupport(): AudioSupport {
  const playback = isAudioContextAvailable();
  const capture = playback && isNativeCaptureAvailable();
  return {
    capture,
    playback,
    detail: capture
      ? 'Voice input and spoken replies are available.'
      : 'Live voice is unavailable here. You can still use the session and read the conversation.',
  };
}

export { base64Pcm16ToFloat, floatToBase64Pcm16, WIRE_SAMPLE_RATE };
