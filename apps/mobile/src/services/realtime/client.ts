/**
 * Live voice session transport.
 *
 * Connects to the Alfie agent service, which holds the Boson credential and
 * proxies the Higgs Realtime event stream. This module owns the microphone and
 * speaker so that barge-in can stop playback the instant the model is
 * interrupted. Audio is streamed only and is never written to disk.
 */

import type { PlaceContext } from '../location';
import {
  createPcmPlayer,
  startMicCapture,
  type MicCapture,
} from '../audio/transport';
import { voiceDiag } from '../audio/diagnostics';
import { resolveRealtimeUrl } from './config';

export type RealtimeMode = 'Discover' | 'Reimagine';
export type VoiceState = 'Listening' | 'Thinking' | 'Speaking';
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type ConversationTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** True while the assistant is still speaking this turn. */
  streaming: boolean;
};

export type RealtimeState = {
  status: ConnectionStatus;
  voice: VoiceState;
  /** Non-null only when something is wrong and the user can retry. */
  error: { message: string; recoverable: boolean } | null;
  /** True when the microphone is live. */
  capturing: boolean;
  /**
   * Microphone loudness, 0..1. Non-zero only while the microphone is actually
   * delivering audio, which is the one signal that distinguishes "connected but
   * deaf" from a working session.
   */
  level: number;
  /** Client audio frames sent this session, for the on-screen proof of life. */
  sentChunks: number;
  /** Provider audio deltas received this session. */
  receivedDeltas: number;
  /** Provider close code, when the session ended because of one. */
  closeCode: number | null;
};

export type RealtimeHandlers = {
  onState: (state: RealtimeState) => void;
  onTurns: (turns: ConversationTurn[]) => void;
  /** Short plain-language status suitable for an accessibility live region. */
  onAnnouncement: (message: string) => void;
};

export type RealtimeSession = {
  start: () => Promise<void>;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  updateLocation: (place: PlaceContext) => void;
  /** Manual barge-in: stop local playback and let the user speak. */
  interrupt: () => void;
};

const INITIAL_STATE: RealtimeState = {
  status: 'idle',
  voice: 'Listening',
  error: null,
  capturing: false,
  level: 0,
  sentChunks: 0,
  receivedDeltas: 0,
  closeCode: null,
};

/**
 * Microphone level above which input_audio_buffer.speech_started is treated as a
 * real person rather than the speaker output leaking into the microphone.
 * levelOf() amplifies RMS by 4, so this is roughly 0.01 raw RMS.
 */
const ECHO_LEVEL_THRESHOLD = 0.04;

/** Events we read fields from. Everything else is ignored on purpose. */
type WireEvent = {
  type?: unknown;
  delta?: unknown;
  transcript?: unknown;
  message?: unknown;
  code?: unknown;
  reason?: unknown;
  closeCode?: unknown;
  recoverable?: unknown;
  item_id?: unknown;
  item?: unknown;
  error?: unknown;
  mode?: unknown;
};

export function createRealtimeSession(
  mode: RealtimeMode,
  handlers: RealtimeHandlers,
): RealtimeSession {
  const player = createPcmPlayer();
  let socket: WebSocket | null = null;
  let capture: MicCapture | null = null;
  let stopped = false;
  let paused = false;
  let turnCounter = 0;

  let state: RealtimeState = { ...INITIAL_STATE };
  let turns: ConversationTurn[] = [];
  let activeAssistantId: string | null = null;

  function emitState(patch: Partial<RealtimeState>): void {
    state = { ...state, ...patch };
    handlers.onState(state);
  }

  function emitTurns(): void {
    handlers.onTurns([...turns]);
  }

  function fail(message: string, recoverable = true): void {
    stopCapture();
    player.flush();
    emitState({
      status: 'error',
      error: { message, recoverable },
      capturing: false,
      level: 0,
    });
    handlers.onAnnouncement(message);
  }

  /**
   * Reports microphone loudness and counts the frames actually sent. Both are
   * shown in the UI: without them a silent microphone and a dead session look
   * exactly the same.
   */
  function reportLevel(level: number): void {
    emitState({ level: Math.round(level * 100) / 100 });
  }

  function stopCapture(): void {
    if (!capture) return;
    try {
      capture.stop();
    } catch {
      /* already released */
    }
    capture = null;
  }

  function currentAssistantTurn(): ConversationTurn | null {
    if (!activeAssistantId) return null;
    return turns.find((turn) => turn.id === activeAssistantId) ?? null;
  }

  function handleEvent(event: WireEvent): void {
    if (typeof event.type !== 'string') return;
    switch (event.type) {
      case 'alfie.ready':
        emitState({ status: 'connected', error: null });
        handlers.onAnnouncement('Connected. Alfie is listening.');
        return;

      case 'alfie.error': {
        const message =
          typeof event.message === 'string'
            ? event.message
            : 'Something went wrong with the voice service.';
        // Provider errors arrive here too and are shown rather than swallowed.
        emitState({
          status: state.status === 'connecting' ? 'error' : state.status,
          error: { message, recoverable: true },
        });
        handlers.onAnnouncement(message);
        return;
      }

      case 'alfie.diagnostic': {
        // Server-side view of why the session ended. Kept so the UI can show the
        // raw close code alongside the plain-language reason.
        emitState({
          closeCode:
            typeof event.closeCode === 'number' ? event.closeCode : null,
        });
        return;
      }

      case 'alfie.closed': {
        if (stopped) return;
        const message =
          typeof event.message === 'string'
            ? event.message
            : 'The session ended.';
        // Never let a generic close message replace a specific provider error
        // that already explained what went wrong.
        const existing = state.error?.message;
        const isGeneric =
          message.startsWith('The voice service closed the session') ||
          message.startsWith('voice service closed the session');
        const finalMessage = isGeneric && existing ? existing : message;
        fail(finalMessage, event.recoverable !== false);
        return;
      }

      case 'input_audio_buffer.speech_started': {
        /**
         * Barge-in. The provider has already cancelled its in-flight response,
         * so local playback must stop too.
         *
         * The guard matters: with speakers rather than headphones, the
         * microphone hears Alfie's own voice, which the provider reports as
         * user speech. Flushing unconditionally then killed every reply a few
         * milliseconds after it started, so the transcript appeared and nothing
         * was audible. The microphone level is the tie-breaker: if the browser
         * is not actually picking up sound, this was echo, not a person.
         */
        const likelyEcho = state.level <= ECHO_LEVEL_THRESHOLD;
        if (likelyEcho) {
          voiceDiag('barge_in.ignored_likely_echo', {
            level: state.level,
            threshold: ECHO_LEVEL_THRESHOLD,
          });
          return;
        }
        voiceDiag('barge_in.flush', { level: state.level });
        player.flush();
        if (activeAssistantId) {
          const turn = currentAssistantTurn();
          if (turn) {
            turns = turns.map((item) =>
              item.id === turn.id ? { ...item, streaming: false } : item,
            );
            emitTurns();
          }
          activeAssistantId = null;
        }
        emitState({ voice: 'Listening' });
        return;
      }

      case 'input_audio_buffer.speech_stopped':
        emitState({ voice: 'Thinking' });
        return;

      case 'conversation.item.input_audio_transcription.completed': {
        const text =
          typeof event.transcript === 'string' ? event.transcript.trim() : '';
        if (!text) return;
        turns = [
          ...turns,
          { id: `u${++turnCounter}`, role: 'user', text, streaming: false },
        ];
        emitTurns();
        return;
      }

      case 'response.created':
        emitState({ voice: 'Thinking' });
        return;

      case 'response.output_audio.delta': {
        if (typeof event.delta === 'string') {
          const bytes = Math.floor((event.delta.length * 3) / 4);
          if (state.receivedDeltas === 0) {
            voiceDiag('HIGGS AUDIO DELTA RECEIVED (first)', {
              chunkNumber: 1,
              base64Chars: event.delta.length,
              byteLength: bytes,
              audioContextState: player.state(),
            });
          } else if ((state.receivedDeltas + 1) % 50 === 0) {
            voiceDiag('HIGGS AUDIO DELTA RECEIVED', {
              chunkNumber: state.receivedDeltas + 1,
              byteLength: bytes,
            });
          }
          player.enqueue(event.delta);
          emitState({ receivedDeltas: state.receivedDeltas + 1 });
          if (state.voice !== 'Speaking') emitState({ voice: 'Speaking' });
        }
        return;
      }

      case 'response.output_audio_transcript.delta': {
        const delta = typeof event.delta === 'string' ? event.delta : '';
        if (!delta) return;
        if (!activeAssistantId) {
          const id = `a${++turnCounter}`;
          activeAssistantId = id;
          turns = [
            ...turns,
            { id, role: 'assistant', text: delta, streaming: true },
          ];
        } else {
          turns = turns.map((turn) =>
            turn.id === activeAssistantId
              ? { ...turn, text: turn.text + delta }
              : turn,
          );
        }
        emitTurns();
        return;
      }

      case 'response.output_audio_transcript.done': {
        const text =
          typeof event.transcript === 'string' ? event.transcript.trim() : '';
        const id = activeAssistantId;
        if (id && text) {
          turns = turns.map((turn) =>
            turn.id === id ? { ...turn, text, streaming: false } : turn,
          );
        } else if (id) {
          turns = turns.map((turn) =>
            turn.id === id ? { ...turn, streaming: false } : turn,
          );
        }
        emitTurns();
        return;
      }

      case 'response.done':
        activeAssistantId = null;
        emitState({ voice: 'Listening' });
        return;

      case 'error': {
        const inner = event.error;
        const message =
          typeof inner === 'object' &&
          inner !== null &&
          typeof (inner as WireEvent).message === 'string'
            ? String((inner as WireEvent).message)
            : 'The voice service reported a problem.';
        emitState({ error: { message, recoverable: true } });
        return;
      }

      default:
        return;
    }
  }

  async function start(): Promise<void> {
    stopped = false;
    paused = false;
    emitState({ status: 'connecting', error: null, voice: 'Listening' });

    /**
     * Resume the speaker from this call, which runs synchronously inside the
     * press that started the session. Chrome's autoplay policy only permits an
     * AudioContext to leave "suspended" from a user gesture; resuming later,
     * when the first audio delta arrives, is a request the browser can refuse —
     * and the reply is then silent with no error anywhere.
     */
    void player.resume();

    const url = resolveRealtimeUrl(mode);
    let socket_: WebSocket;
    try {
      socket_ = new WebSocket(url);
    } catch {
      fail(
        'Could not open a voice connection. Check that the Alfie agent service is running and reachable.',
      );
      return;
    }
    socket = socket_;

    socket_.onopen = () => {
      // The socket to the Alfie agent is open, but the upstream Higgs session is
      // not confirmed yet. Reporting "connected" here would be a claim we cannot
      // back up; the agent sends `alfie.ready` once the provider acknowledges.
      emitState({ status: 'connecting', error: null });
    };

    socket_.onmessage = (message) => {
      if (typeof message.data !== 'string') return;
      let parsed: WireEvent;
      try {
        parsed = JSON.parse(message.data) as WireEvent;
      } catch {
        return;
      }
      handleEvent(parsed);
    };

    socket_.onerror = () => {
      if (stopped) return;
      fail(
        'Lost the connection to the voice service. Check that the agent service is running, then retry.',
      );
    };

    socket_.onclose = () => {
      if (stopped) return;
      stopCapture();
      player.flush();
      if (state.status !== 'error') {
        fail('The voice session ended unexpectedly. You can reconnect.', true);
      }
    };

    // Microphone starts only after the user has explicitly begun a session.
    try {
      capture = await startMicCapture({
        onChunk: (base64Pcm16) => {
          if (paused || stopped) return;
          emitState({ sentChunks: state.sentChunks + 1 });
          send({ type: 'input_audio_buffer.append', audio: base64Pcm16 });
        },
        onLevel: reportLevel,
        onError: (error) => {
          stopCapture();
          emitState({ capturing: false, level: 0 });
          fail(error.message, true);
        },
      });
      emitState({ capturing: true });
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'The microphone is not available.';
      emitState({ capturing: false });
      fail(message, true);
    }
  }

  function send(event: Record<string, unknown>): void {
    if (!socket || socket.readyState !== 1) return;
    try {
      socket.send(JSON.stringify(event));
    } catch {
      /* the close handler reports the failure */
    }
  }

  function stop(): void {
    stopped = true;
    stopCapture();
    player.flush();
    player.dispose();
    const socket_ = socket;
    socket = null;
    if (socket_) {
      socket_.onclose = null;
      socket_.onerror = null;
      try {
        socket_.close(1000, 'session ended');
      } catch {
        /* already closed */
      }
    }
    state = { ...INITIAL_STATE };
    handlers.onState(state);
  }

  function setPaused(next: boolean): void {
    paused = next;
    if (next) {
      player.flush();
      // Stop the model mid-utterance and keep the microphone closed.
      send({ type: 'response.cancel' });
      stopCapture();
      emitState({ capturing: false, level: 0 });
    } else if (!capture && !stopped) {
      void startMicCapture({
        onChunk: (base64Pcm16) => {
          if (paused || stopped) return;
          emitState({ sentChunks: state.sentChunks + 1 });
          send({ type: 'input_audio_buffer.append', audio: base64Pcm16 });
        },
        onLevel: reportLevel,
        onError: (error) => fail(error.message, true),
      })
        .then((next) => {
          capture = next;
          emitState({ capturing: true });
        })
        .catch(() => {
          emitState({ capturing: false, level: 0 });
          handlers.onAnnouncement(
            'Still paused without a microphone. Resume again to retry.',
          );
        });
    }
  }

  return {
    start,
    stop,
    setPaused,
    updateLocation(place: PlaceContext) {
      send({
        type: 'alfie.location',
        location: {
          id: place.id,
          label: place.label,
          detail: place.detail,
          activity: place.activity,
          simulated: place.simulated,
        },
      });
    },
    interrupt() {
      player.flush();
      send({ type: 'response.cancel' });
      emitState({ voice: 'Listening' });
      handlers.onAnnouncement('Stopped. Alfie is listening.');
    },
  };
}
