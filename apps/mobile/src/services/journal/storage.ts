/**
 * Local-only Field Log storage.
 *
 * Everything here stays on the device. Nothing is uploaded, and no credentials
 * or audio are ever written. The backend never sees a Field Log entry.
 *
 * Storage is device-local on both platforms, behind `backend.native.ts` (a JSON
 * file in the app document directory) and `backend.web.ts` (`localStorage`).
 * Where neither works, the log lives in memory for the current run only and
 * `isPersistent()` reports that honestly so the UI can say so instead of
 * implying a save.
 */

import { createJournalBackend } from './backend';

export type JournalMode = 'Discover' | 'Reimagine';

export type JournalThought = {
  id: string;
  text: string;
  createdAt: string;
};

export type JournalTheme = {
  /** Short label, drawn from the user's own words. */
  label: string;
  /** The sentence the label came from, for context. */
  detail: string;
};

export type JournalRoutePoint = {
  id: string;
  label: string;
  at: string;
  simulated: boolean;
};

export type JournalSession = {
  id: string;
  mode: JournalMode;
  startedAt: string;
  /** Null while the session is still open. */
  endedAt: string | null;
  durationMs: number;
  thoughts: JournalThought[];
  themes: JournalTheme[];
  route: JournalRoutePoint[];
  /** Number of completed assistant turns, used only as a light activity signal. */
  voiceTurns: number;
  /** True when the whole session used simulated location. */
  simulatedLocation: boolean;
};

const MAX_SESSIONS = 25;

/**
 * Platform storage: a JSON file in the app document directory on native, and
 * `localStorage` on web. Both are device-local; neither uploads anything.
 */
const backend = createJournalBackend();

/** True when entries survive an app restart on this device. */
export function isPersistent(): boolean {
  return backend.persistent;
}

/** Honest, plain-language description of where entries are kept. */
export function storageLabel(): string {
  return backend.label;
}

function isSession(value: unknown): value is JournalSession {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (record.mode === 'Discover' || record.mode === 'Reimagine') &&
    typeof record.startedAt === 'string' &&
    Array.isArray(record.thoughts)
  );
}

export function loadSessions(): JournalSession[] {
  try {
    const raw = backend.read();
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSession).map(normalise);
  } catch {
    return [];
  }
}

function normalise(session: JournalSession): JournalSession {
  return {
    ...session,
    endedAt: session.endedAt ?? null,
    durationMs: typeof session.durationMs === 'number' ? session.durationMs : 0,
    thoughts: Array.isArray(session.thoughts) ? session.thoughts : [],
    themes: Array.isArray(session.themes) ? session.themes : [],
    route: Array.isArray(session.route) ? session.route : [],
    voiceTurns: typeof session.voiceTurns === 'number' ? session.voiceTurns : 0,
    simulatedLocation: session.simulatedLocation === true,
  };
}

export function writeSessions(sessions: JournalSession[]): JournalSession[] {
  const trimmed = sessions.slice(0, MAX_SESSIONS);
  backend.write(JSON.stringify(trimmed));
  return trimmed;
}

export function upsertSession(session: JournalSession): JournalSession[] {
  const sessions = loadSessions();
  const index = sessions.findIndex((item) => item.id === session.id);
  const next =
    index === -1
      ? [session, ...sessions]
      : sessions.map((item) => (item.id === session.id ? session : item));
  return writeSessions(next);
}

export function deleteSession(id: string): JournalSession[] {
  return writeSessions(loadSessions().filter((item) => item.id !== id));
}

export function clearAllSessions(): JournalSession[] {
  backend.clear();
  return [];
}

export function createSessionId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `s${Date.now().toString(36)}${random}`;
}

export function createThoughtId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `t${Date.now().toString(36)}${random}`;
}
