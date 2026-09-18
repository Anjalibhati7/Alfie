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
import { parseEvent, type ServerEvent } from './protocol.js';
import {
  buildInstructions,
  buildLocationNote,
  type Mode,
} from './prompt.js';

export type SessionDeps = {
  config: Config;
  /** Send a JSON frame to the mobile client. Returns false if the socket is gone. */
  send: (event: Record<string, unknown>) => void;
  /** Called once when the session ends, for operational counters only. */
  onClose: (summary: SessionSummary) => void;
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
};

export class RealtimeSession {
  private readonly upstream: WebSocket;
  private readonly state: SessionState;
  private closeTimer: NodeJS.Timeout | null = null;

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
    this.upstream.on('close', (code) => {
      this.close(
        'upstream-closed',
        `voice service closed the session (${code})`,
      );
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
    this.forward(event);
  }

  close(reason: string, message: string): void {
    if (this.state.closed) return;
    this.state.closed = true;
    if (this.closeTimer) clearTimeout(this.closeTimer);
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

  private handleUpstreamOpen(): void {
    this.send({
      type: 'session.update',
      session: {
        model: this.deps.config.bosonModel,
        instructions: buildInstructions({ mode: this.state.mode }),
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            turn_detection: { type: 'server_vad' },
            transcription: { model: 'higgs-stt-3.1' },
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 },
            voice: 'default',
          },
        },
        output_modalities: ['audio'],
      },
    });
    this.deps.send({
      type: 'alfie.ready',
      mode: this.state.mode,
      model: this.deps.config.bosonModel,
      hasLocation: this.state.location !== null,
    });
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
    this.send({
      type: 'session.update',
      session: {
        ...clientSession,
        model: this.deps.config.bosonModel,
        instructions: buildInstructions({
          mode: this.state.mode,
          location: this.state.location ?? undefined,
        }),
      },
    });
  }

  private handleLocation(input: unknown): void {
    const location = parseLocationContext(input);
    if (!location) return;
    this.state.location = location;
    if (location.id === this.state.lastLocationId) return;
    this.state.lastLocationId = location.id;

    if (!this.state.closed) {
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{ type: 'input_text', text: buildLocationNote(location) }],
        },
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
    this.track(event);
    this.deps.send(event);
  }

  private track(event: ServerEvent): void {
    if (event.type === 'response.output_audio.delta') {
      this.state.audioChunks += 1;
      return;
    }
    if (event.type === 'response.done') {
      this.state.turns += 1;
      return;
    }
    if (event.type === 'error') {
      this.deps.send({
        type: 'alfie.error',
        stage: 'voice',
        message: describeError(event),
      });
    }
  }

  private handleUpstreamError(error: Error): void {
    // The error text can contain request metadata, so it is classified rather
    // than forwarded verbatim.
    void error;
    this.fail(
      'upstream-unreachable',
      'Could not reach the voice service. Check the server network connection and try again.',
    );
  }

  private fail(code: string, message: string): void {
    if (this.state.closed) return;
    this.deps.send({ type: 'alfie.error', stage: 'connection', code, message });
    this.close('upstream-error', message);
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
