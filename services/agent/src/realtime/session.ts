/**
 * Live Higgs Realtime session.
 *
 * The mobile app never holds a Boson credential. It opens a WebSocket to this
 * service, which opens the upstream Higgs Realtime socket with the server-side
 * `BOSON_API_KEY` and relays the JSON event stream in both directions.
 *
 * The only messages this service rewrites are session configuration (so mode
 * behaviour and safety rules cannot be overridden by the client) and location
 * context. Audio and transcript events pass through untouched and are never
 * written to disk or to logs.
 */

import WebSocket from 'ws';
import type { Config } from '../config.js';
import {
  parseLocationContext,
  type LocationContext,
} from '../location/context.js';
import { explainClose } from './closeCodes.js';
import { parseEvent, type ServerEvent } from './protocol.js';
import { buildInstructions, type Mode } from './prompt.js';

export type SessionDeps = {
  config: Config;
  /** Send a JSON frame to the mobile client. Returns false if the socket is gone. */
  send: (event: Record<string, unknown>) => void;
  /** Called once when the session ends, for operational counters only. */
  onClose: (summary: SessionSummary) => void;
  /**
   * Structured diagnostic log line. Event names, counters, and provider error
   * text only — never audio, transcripts, coordinates, or credentials.
   */
  log: (line: Record<string, unknown>) => void;
};

export type SessionSummary = {
  reason: string;
  turns: number;
  audioChunks: number;
};

type SessionState = {
  mode: Mode;
  location: LocationContext | null;
  lastLocationId: string | null;
  turns: number;
  audioChunks: number;
  closed: boolean;
  /**
   * True once upstream has acknowledged the session configuration. A successful
   * WebSocket handshake is NOT enough: the provider accepts the socket and then
   * rejects the session (for example on an invalid key or an account without
   * credit), so "ready" is only reported after the provider confirms.
   */
  established: boolean;
  /**
   * The most recent provider `error` event, kept verbatim. The close frame alone
   * is often less informative than the error that preceded it, and this is what
   * gets surfaced to the user instead of a generic "session closed" message.
   */
  lastUpstreamError: Record<string, unknown> | null;
  /** Client audio frames received, for the audio-path diagnostics. */
  appendChunks: number;
  /** Provider audio deltas relayed, for the audio-path diagnostics. */
  outputDeltas: number;
  /** Audio held until the provider confirms the session. */
  pendingAudio: Record<string, unknown>[];
  /**
   * The last full session configuration sent upstream. Re-sent with refreshed
   * instructions when the user's surroundings change, because the provider
   * rejects system-role conversation items.
   */
  baseSession: Record<string, unknown> | null;
};

/**
 * ISO-639-1 hint for input transcription. Higgs accepts an optional language
 * field on the transcription config; supplying it stops the recogniser from
 * auto-detecting, which was returning a different language entirely for quiet
 * or noisy speech. Override with ALFIE_INPUT_LANGUAGE.
 */
function inputLanguage(): string {
  const value = process.env.ALFIE_INPUT_LANGUAGE?.trim();
  return value ? value.slice(0, 5) : 'en';
}

/** How long to wait for the provider to acknowledge a session. */
const ESTABLISH_TIMEOUT_MS = 10_000;

/**
 * Roughly 5 seconds of 100 ms frames. Beyond this the client is assumed to be
 * streaming into a session that will never come up.
 */
const MAX_PENDING_AUDIO_CHUNKS = 50;

export class RealtimeSession {
  private readonly upstream: WebSocket;
  private readonly state: SessionState;
  private closeTimer: NodeJS.Timeout | null = null;
  private establishTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly deps: SessionDeps,
    mode: Mode,
  ) {
    this.state = {
      mode,
      location: null,
      lastLocationId: null,
      turns: 0,
      audioChunks: 0,
      closed: false,
      established: false,
      lastUpstreamError: null,
      appendChunks: 0,
      outputDeltas: 0,
      pendingAudio: [],
      baseSession: null,
    };

    const url = new URL(deps.config.bosonRealtimeUrl);
    url.searchParams.set('model', deps.config.bosonModel);

    this.upstream = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${deps.config.bosonApiKey ?? ''}`,
      },
    });

    this.upstream.on('open', () => this.handleUpstreamOpen());
    this.upstream.on('message', (data) => this.handleUpstreamMessage(data));
    this.upstream.on('error', (error) => this.handleUpstreamError(error));
    this.upstream.on('unexpected-response', (_request, response) => {
      this.fail(
        response.statusCode === 401 || response.statusCode === 403
          ? 'upstream-auth'
          : 'upstream-handshake',
        response.statusCode === 401 || response.statusCode === 403
          ? 'The voice service rejected its credentials. Check that BOSON_API_KEY is set correctly on the server.'
          : `The voice service refused the connection (HTTP ${response.statusCode}).`,
      );
    });
    this.upstream.on('close', (code, reasonBuffer) => {
      const reason = reasonBuffer?.toString() ?? '';
      this.deps.log({
        event: 'upstream.close',
        closeCode: code,
        closeReason: reason || null,
        established: this.state.established,
        appendChunks: this.state.appendChunks,
        outputDeltas: this.state.outputDeltas,
      });

      const explained = explainClose(code, reason);
      // The provider error event, when there is one, is more specific than the
      // close code. Surface it rather than flattening everything into
      // "session closed (code)".
      const upstreamDetail = this.describeLastUpstreamError();
      const message = upstreamDetail
        ? `${explained.message} ${upstreamDetail}`
        : explained.message;

      this.deps.send({
        type: 'alfie.diagnostic',
        closeCode: code,
        closeReason: reason || null,
        established: this.state.established,
        appendChunks: this.state.appendChunks,
        outputDeltas: this.state.outputDeltas,
        upstreamError: this.state.lastUpstreamError,
      });
      this.fail(explained.code, message);
    });

    // A demo session should never be able to run indefinitely by accident.
    this.closeTimer = setTimeout(
      () => this.close('max-duration', 'session reached the maximum length'),
      deps.config.maxSessionMs,
    );
    this.closeTimer.unref?.();
  }

  /** Handle a frame from the mobile client. */
  handleClientMessage(raw: string): void {
    const event = parseEvent(raw);
    if (!event) return;

    if (event.type === 'alfie.location') {
      this.handleLocation(event.location);
      return;
    }
    if (event.type === 'alfie.ping') {
      this.deps.send({ type: 'alfie.pong' });
      return;
    }
    if (event.type === 'session.update') {
      this.forwardSessionUpdate(event.session);
      return;
    }
    if (event.type === 'input_audio_buffer.append') {
      this.state.appendChunks += 1;
      const bytes =
        typeof event.audio === 'string'
          ? Math.floor((event.audio.length * 3) / 4)
          : 0;
      // The first frame is logged on its own: it is the proof that microphone
      // audio is arriving from the browser at all.
      if (this.state.appendChunks === 1) {
        this.deps.log({
          event: 'client.audio.first_chunk',
          approxBytes: bytes,
        });
      } else if (this.state.appendChunks % 50 === 0) {
        this.deps.log({
          event: 'client.audio.append',
          chunkIndex: this.state.appendChunks,
          approxBytes: bytes,
        });
      }
      if (!this.state.established) {
        // The browser starts the microphone as soon as the socket opens, which
        // can be before the provider confirms the session. Sending audio now
        // risks an error, but dropping it would swallow the user's first words,
        // so a short window is held and flushed on confirmation.
        if (this.state.pendingAudio.length < MAX_PENDING_AUDIO_CHUNKS) {
          this.state.pendingAudio.push(event);
        }
        if (this.state.appendChunks === 1) {
          this.deps.log({
            event: 'client.audio.before_established',
            note: 'buffering audio until the provider confirms the session',
          });
        }
        return;
      }
      this.forward(event);
      return;
    }
    this.forward(event);
  }

  /** Renders the provider's error payload as a short, human-readable suffix. */
  private describeLastUpstreamError(): string | null {
    const error = this.state.lastUpstreamError;
    if (!error) return null;
    const inner =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)
        : error;
    const parts: string[] = [];
    for (const key of ['message', 'type', 'code', 'param']) {
      const value = inner[key];
      if (typeof value === 'string' && value.trim()) parts.push(value.trim());
    }
    if (parts.length === 0) return null;
    return `Provider error: ${parts.join(' | ')}.`;
  }

  close(reason: string, message: string): void {
    if (this.state.closed) return;
    this.state.closed = true;
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (this.establishTimer) clearTimeout(this.establishTimer);
    this.deps.log({ event: 'session.close', reason, detail: message });
    this.deps.send({
      type: 'alfie.closed',
      reason,
      message,
      recoverable: true,
    });
    try {
      this.upstream.close(1000, reason.slice(0, 100));
    } catch {
      /* the socket may already be gone */
    }
    this.deps.onClose({
      reason,
      turns: this.state.turns,
      audioChunks: this.state.audioChunks,
    });
  }

  /**
   * Called when the provider acknowledges the session. Only now can the client
   * be told the session is live: the WebSocket handshake alone does not mean the
   * credential, model, and account are accepted.
   */
  private establish(): void {
    if (this.state.established || this.state.closed) return;
    this.state.established = true;
    if (this.establishTimer) {
      clearTimeout(this.establishTimer);
      this.establishTimer = null;
    }
    this.deps.send({
      type: 'alfie.ready',
      mode: this.state.mode,
      model: this.deps.config.bosonModel,
      hasLocation: this.state.location !== null,
    });

    // Release any audio captured while the session was still coming up.
    const pending = this.state.pendingAudio;
    this.state.pendingAudio = [];
    if (pending.length > 0) {
      this.deps.log({
        event: 'client.audio.flushed',
        chunks: pending.length,
      });
      for (const frame of pending) {
        this.send(frame);
      }
    }

    // The browser reports its first place as soon as the session starts, which
    // is usually before the provider confirms it. That update was recorded but
    // could not be applied yet, so it is folded into the instructions now.
    if (this.state.location && this.state.baseSession) {
      this.deps.log({
        event: 'location.applied_on_establish',
        placeId: this.state.location.id,
      });
      this.sendSessionUpdate({
        ...this.state.baseSession,
        instructions: buildInstructions({
          mode: this.state.mode,
          location: this.state.location,
        }),
      });
    }
  }

  private handleUpstreamOpen(): void {
    this.deps.log({
      event: 'upstream.open',
      endpoint: `${new URL(this.deps.config.bosonRealtimeUrl).origin}${new URL(this.deps.config.bosonRealtimeUrl).pathname}`,
      model: this.deps.config.bosonModel,
      // Presence, length, and a non-reversible fingerprint. Never the value.
      credentialPresent: this.deps.config.bosonApiKey !== undefined,
      credentialLength: this.deps.config.bosonKeyLength,
      credentialFingerprint: this.deps.config.bosonKeyFingerprint,
      credentialSource: this.deps.config.keySource,
    });
    this.sendSessionUpdate({
      model: this.deps.config.bosonModel,
      instructions: buildInstructions({ mode: this.state.mode }),
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          // Helps a phone or laptop microphone in a normal room.
          noise_reduction: { type: 'near_field' },
          turn_detection: { type: 'server_vad' },
          // The language hint is deliberate: without it the recogniser
          // auto-detects, and noisy or quiet input was being detected as a
          // different language entirely. See ALFIE_INPUT_LANGUAGE.
          transcription: {
            model: 'higgs-stt-3.1',
            language: inputLanguage(),
          },
        },
        output: {
          format: { type: 'audio/pcm', rate: 24000 },
          voice: 'default',
        },
      },
      output_modalities: ['audio'],
    });
    // The provider sends nothing until the first session.update, so "ready" is
    // held back until that is acknowledged rather than assumed.
    this.establishTimer = setTimeout(() => {
      this.fail(
        'upstream-timeout',
        'The voice service did not confirm the session in time. Check the server credential and network, then retry.',
      );
    }, ESTABLISH_TIMEOUT_MS);
    this.establishTimer.unref?.();
  }

  /** Sends session.update and records exactly what was configured. */
  private sendSessionUpdate(session: Record<string, unknown>): void {
    this.state.baseSession = session;
    const audio = session.audio as Record<string, unknown> | undefined;
    const input = audio?.input as Record<string, unknown> | undefined;
    const output = audio?.output as Record<string, unknown> | undefined;
    this.deps.log({
      event: 'session.update.sent',
      model: session.model ?? null,
      outputModalities: session.output_modalities ?? null,
      inputFormat: input?.format ?? null,
      outputFormat: output?.format ?? null,
      turnDetection: input?.turn_detection ?? null,
      transcription: input?.transcription ?? null,
      voice: output?.voice ?? null,
      instructionChars:
        typeof session.instructions === 'string'
          ? session.instructions.length
          : 0,
    });
    this.send({ type: 'session.update', session });
  }

  /**
   * Client session config is merged onto server-authoritative fields, so mode
   * instructions and the model choice cannot be overridden from the device.
   */
  private forwardSessionUpdate(session: unknown): void {
    const clientSession =
      typeof session === 'object' && session !== null
        ? (session as Record<string, unknown>)
        : {};
    this.sendSessionUpdate({
      ...clientSession,
      model: this.deps.config.bosonModel,
      instructions: buildInstructions({
        mode: this.state.mode,
        location: this.state.location ?? undefined,
      }),
    });
  }

  private handleLocation(input: unknown): void {
    const location = parseLocationContext(input);
    if (!location) return;
    this.state.location = location;
    if (location.id === this.state.lastLocationId) return;
    this.state.lastLocationId = location.id;

    // Higgs Realtime rejects `system`-role conversation items:
    //   "conversation.item.create supports text content only ... and
    //    system-role messages are rejected."
    // Sending one produced an error event and killed the session the moment the
    // browser reported its first place. Instructions are the supported way to
    // change agent context mid-session, so the location is folded into a
    // refreshed session.update instead.
    const base = this.state.baseSession;
    if (!this.state.closed && base && this.state.established) {
      this.sendSessionUpdate({
        ...base,
        instructions: buildInstructions({
          mode: this.state.mode,
          location,
        }),
      });
    }

    this.deps.send({
      type: 'alfie.location.ack',
      id: location.id,
      simulated: location.simulated,
    });
  }

  private handleUpstreamMessage(data: WebSocket.RawData): void {
    const text = typeof data === 'string' ? data : data.toString();
    const event = parseEvent(text);
    if (!event) return;

    // `session.created` acknowledges the first session.update, and
    // `session.updated` acknowledges a later one. Either means the provider has
    // accepted the credential and configuration.
    if (event.type === 'session.created') {
      this.deps.log({
        event: 'upstream.session.created',
        sessionId:
          typeof (event.session as Record<string, unknown> | undefined)?.id ===
          'string'
            ? (event.session as Record<string, unknown>).id
            : null,
      });
      this.establish();
    } else if (event.type === 'session.updated') {
      this.deps.log({ event: 'upstream.session.updated' });
      this.establish();
    }

    this.track(event);
    this.deps.send(event);
  }

  private track(event: ServerEvent): void {
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        this.deps.log({ event: 'upstream.speech.started' });
        return;
      case 'input_audio_buffer.speech_stopped':
        this.deps.log({ event: 'upstream.speech.stopped' });
        return;
      case 'response.output_audio.delta': {
        this.state.audioChunks += 1;
        this.state.outputDeltas += 1;
        // The first delta is the proof that the provider is speaking back.
        if (this.state.outputDeltas === 1) {
          this.deps.log({
            event: 'upstream.audio.first_delta',
            // Metadata only: never the audio itself.
            base64Chars:
              typeof event.delta === 'string' ? event.delta.length : 0,
            byteLength:
              typeof event.delta === 'string'
                ? Math.floor((event.delta.length * 3) / 4)
                : 0,
          });
        } else if (this.state.outputDeltas % 100 === 0) {
          this.deps.log({
            event: 'upstream.audio.delta',
            deltaIndex: this.state.outputDeltas,
          });
        }
        return;
      }
      case 'response.done':
        this.state.turns += 1;
        return;
      case 'error': {
        // Keep the payload verbatim: it is the most specific thing the provider
        // tells us, and it must survive to the user-facing message.
        this.state.lastUpstreamError = event;
        const message = describeError(event);
        this.deps.log({
          event: 'upstream.error',
          detail: JSON.stringify(event).slice(0, 2000),
        });
        this.deps.send({ type: 'alfie.error', stage: 'voice', message });
        return;
      }
      default:
        return;
    }
  }

  private handleUpstreamError(error: Error): void {
    // The error text can contain request metadata, so it is classified rather
    // than forwarded verbatim.
    this.deps.log({ event: 'upstream.transport.error', name: error.name });
    this.fail(
      'upstream-unreachable',
      'Could not reach the voice service. Check the server network connection and try again.',
    );
  }

  private fail(code: string, message: string): void {
    if (this.state.closed) return;
    this.deps.send({ type: 'alfie.error', stage: 'connection', code, message });
    this.close(code, message);
  }

  private forward(event: ServerEvent): void {
    if (this.state.closed) return;
    this.send(event as Record<string, unknown>);
  }

  private send(event: Record<string, unknown>): void {
    if (this.upstream.readyState !== WebSocket.OPEN) return;
    this.upstream.send(JSON.stringify(event));
  }
}

function describeError(event: ServerEvent): string {
  const inner = event.error;
  if (typeof inner === 'object' && inner !== null) {
    const message = (inner as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim().slice(0, 300);
    }
  }
  return 'The voice service reported an error.';
}
