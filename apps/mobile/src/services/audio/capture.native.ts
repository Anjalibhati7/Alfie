/**
 * Native microphone capture, using the `AudioRecorder` from
 * `react-native-audio-api`. This is the primary capture path for the real app.
 *
 * The recorder is configured for the smallest honest footprint: file output is
 * explicitly disabled, the buffer callback is the only consumer, and the audio
 * session is deactivated again on stop so capture never outlives the session.
 *
 * Privacy: raw samples exist in memory for one callback at a time and are
 * converted straight to base64 for the socket. Nothing is written to disk.
 */

import { loadNativeAudioApi, type NativeAudioApi } from './nativeAudioApi';
import { floatToBase64Pcm16, LinearResampler, WIRE_SAMPLE_RATE } from './pcm';
import {
  CAPTURE_UNSUPPORTED_MESSAGE,
  MIC_DENIED_MESSAGE,
  MIC_UNAVAILABLE_MESSAGE,
  type AudioTransportError,
  type MicCapture,
  type MicCaptureHandlers,
} from './types';

/** ~100 ms of audio at 24 kHz: responsive without flooding the socket. */
const PREFERRED_BUFFER_LENGTH = 2_400;
/** Matches the wire format so the recorder resamples where the device can. */
const PREFERRED_SAMPLE_RATE = WIRE_SAMPLE_RATE;

function unsupported(): AudioTransportError {
  return { code: 'capture-unsupported', message: CAPTURE_UNSUPPORTED_MESSAGE };
}

/**
 * Starts native capture. Rejects with an AudioTransportError when permission is
 * declined or the device has no usable input; never throws otherwise.
 */
export async function startPlatformCapture(
  handlers: MicCaptureHandlers,
): Promise<MicCapture> {
  const api: NativeAudioApi | null = loadNativeAudioApi();
  if (!api) throw unsupported();

  let granted: string;
  try {
    const current = await api.AudioManager.checkRecordingPermissions();
    granted =
      current === 'Granted'
        ? current
        : await api.AudioManager.requestRecordingPermissions();
  } catch {
    throw unsupported();
  }

  if (granted !== 'Granted') {
    throw {
      code: 'mic-denied',
      message: MIC_DENIED_MESSAGE,
    } satisfies AudioTransportError;
  }

  let recorder: InstanceType<NativeAudioApi['AudioRecorder']>;
  try {
    recorder = new api.AudioRecorder();
    // Explicitly no file output: Alfie must never persist raw microphone audio.
    recorder.disableFileOutput();
  } catch {
    throw unsupported();
  }

  // The delivered rate can differ from the preference depending on the device,
  // so the resampler is built from the first buffer that actually arrives.
  let resampler: LinearResampler | null = null;
  let resamplerRate = -1;

  try {
    recorder.onAudioReady(
      {
        sampleRate: PREFERRED_SAMPLE_RATE,
        bufferLength: PREFERRED_BUFFER_LENGTH,
        channelCount: 1,
      },
      (event) => {
        try {
          const buffer = event.buffer;
          if (!buffer) return;
          if (resampler === null || resamplerRate !== buffer.sampleRate) {
            resamplerRate = buffer.sampleRate;
            resampler = new LinearResampler(
              buffer.sampleRate,
              WIRE_SAMPLE_RATE,
            );
          }
          const resampled = resampler.process(buffer.getChannelData(0));
          if (resampled.length === 0) return;
          handlers.onChunk(floatToBase64Pcm16(resampled));
        } catch {
          // One bad buffer must not tear down a live conversation.
        }
      },
    );

    recorder.onError(() => {
      handlers.onError({
        code: 'mic-unavailable',
        message: MIC_UNAVAILABLE_MESSAGE,
      });
    });
  } catch {
    throw unsupported();
  }

  try {
    await api.AudioManager.setAudioSessionActivity(true);
  } catch {
    /* the recorder can still start with the session already active */
  }

  let started: { status: string };
  try {
    started = await recorder.start();
  } catch {
    throw {
      code: 'mic-unavailable',
      message: MIC_UNAVAILABLE_MESSAGE,
    } satisfies AudioTransportError;
  }
  if (started.status === 'error') {
    throw {
      code: 'mic-unavailable',
      message: MIC_UNAVAILABLE_MESSAGE,
    } satisfies AudioTransportError;
  }

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        recorder.clearOnAudioReady();
        recorder.clearOnError();
      } catch {
        /* nothing registered */
      }
      void recorder.stop().catch(() => undefined);
      void api.AudioManager.setAudioSessionActivity(false).catch(
        () => undefined,
      );
    },
  };
}

export function isNativeCaptureAvailable(): boolean {
  return loadNativeAudioApi() !== null;
}
