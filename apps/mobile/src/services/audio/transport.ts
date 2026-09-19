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
import { createLimitedDiag, voiceDiag } from './diagnostics';
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

/**
 * If the reply is already this far ahead of the playhead, something is wrong
 * (a stalled context, or deltas arriving far faster than realtime). Dropping a
 * chunk is survivable; letting the queue grow without bound is not.
 */
const DROP_ABOVE_LEAD_S = 20;

/**
 * Creates the speaker. The context is created eagerly so the first audio delta
 * can be scheduled without a gap, but nothing is audible until `enqueue`.
 */
export function createPcmPlayer(): PcmPlayer {
  const context = createAudioContext();
  const resampler = context
    ? new LinearResampler(WIRE_SAMPLE_RATE, context.sampleRate)
    : null;

  voiceDiag('player.created', {
    contextState: context?.state ?? 'none',
    contextSampleRate: context?.sampleRate ?? 0,
    wireRate: WIRE_SAMPLE_RATE,
    resampling: resampler ? !resampler.passthrough : false,
  });

  /**
   * Scheduled sources with the time each finishes. The completion callback is
   * named differently on native and web, so sources are pruned by time instead.
   */
  let scheduled: { source: { stop: () => void }; endsAt: number }[] = [];
  let nextStartTime = 0;
  let disposed = false;
  let scheduledCount = 0;
  const logFirstBuffer = createLimitedDiag('playback.first_buffer', 1);

  function prune(now: number): void {
    scheduled = scheduled.filter((item) => item.endsAt > now);
  }

  function schedule(base64: string): void {
    if (!context || !resampler) {
      voiceDiag('playback.unavailable', {
        hasContext: Boolean(context),
        hasResampler: Boolean(resampler),
      });
      return;
    }
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

    /**
     * Chunks must play strictly in order, so `nextStartTime` is the authority.
     *
     * An earlier version clamped this to `now + 1` to "catch up"; that made
     * every chunk past one second share a start time, so they all played at
     * once and the reply became unintelligible. Dropping a chunk is far less
     * damaging than overlapping the queue.
     */
    const startAt = Math.max(now + 0.03, nextStartTime);
    if (startAt > now + DROP_ABOVE_LEAD_S) {
      voiceDiag('playback.dropped_chunk', {
        leadSeconds: Number((startAt - now).toFixed(2)),
      });
      return;
    }

    const duration = samples.length / context.sampleRate;
    nextStartTime = startAt + duration;
    scheduled.push({ source, endsAt: nextStartTime });
    scheduledCount += 1;

    logFirstBuffer({
      scheduledAt: Number(startAt.toFixed(3)),
      currentTime: Number(now.toFixed(3)),
      seconds: Number(duration.toFixed(3)),
      samples: samples.length,
      contextState: context.state,
    });

    try {
      source.start(startAt);
    } catch (error) {
      scheduled = scheduled.filter((item) => item.source !== source);
      voiceDiag('playback.start_failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return {
    enqueue(base64: string) {
      if (disposed || !base64 || !context) return;
      if (context.state === 'suspended') {
        // Best effort. The reliable fix is resume() from the starting gesture.
        void context.resume().catch(() => undefined);
      }
      schedule(base64);
    },
    state() {
      return context?.state ?? 'none';
    },
    async resume() {
      if (!context) return;
      try {
        if (context.state !== 'running') await context.resume();
      } catch (error) {
        voiceDiag('player.resume_failed', {
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
      voiceDiag('player.resumed', { contextState: context.state });
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
      voiceDiag('player.disposed', { scheduledCount });
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
