/**
 * Minimal typed view of the Higgs Realtime (OpenAI-Realtime-compatible)
 * event protocol. Only the shapes this service reads or writes are declared;
 * every other event is relayed untouched.
 */

export const REALTIME_MODEL_FALLBACK = 'higgs-realtime';

/** Events the mobile client may send us that are not part of the wire protocol. */
export type AlfieClientEvent =
  | { type: 'alfie.location'; location: unknown }
  | { type: 'alfie.mode' }
  | { type: 'alfie.ping' };

export type ServerEvent = {
  type: string;
  [key: string]: unknown;
};

export type SessionUpdateEvent = {
  type: 'session.update';
  session: Record<string, unknown>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Parse a raw WebSocket frame into an event object. Returns null for anything
 * that is not a JSON object with a string `type`, so malformed frames are
 * dropped rather than crashing a live session.
 */
export function parseEvent(raw: string): ServerEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (typeof value.type !== 'string') return null;
  return value as ServerEvent;
}

/** Audio deltas are the only events large enough to matter for relaying. */
export function isAudioDelta(event: ServerEvent): boolean {
  return event.type === 'response.output_audio.delta';
}
