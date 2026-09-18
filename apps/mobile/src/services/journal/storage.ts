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

export type JournalMoment = {
  /** Milliseconds from the start of the session. */
  atMs: number;
  label: string;
};

export type JournalRoutePoint = {
  id: string;
  label: string;
  at: string;
  simulated: boolean;
};

/**
 * One outing, remembered.
 *
 * This is deliberately a record of the walk and not of the conversation: there
 * is no transcript field, and there never should be. `observations`, `themes`,
 * and `moments` are derived once when the session ends (see `summarise.ts`) and
 * are the only trace of what was said.
 */
export type JournalSession = {
  id: string;
  mode: JournalMode;
  startedAt: string;
  /** Null while the session is still open. */
  endedAt: string | null;
  durationMs: number;
  /** Where the outing happened, e.g. "The Embarcadero". Null when unknown. */
  placeLabel: string | null;
  /** "You noticed" — short observational phrases. */
  observations: string[];
  /** "Conversation themes" — concise topic labels. */
  themes: string[];
  /** "Moments" — timestamped points from the walk. */
  moments: JournalMoment[];
  thoughts: JournalThought[];
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

/**
 * Accepts records written by earlier versions.
 *
 * Sessions saved before the Field Log became a memory of the outing stored
 * themes as `{label, detail}` objects and had no observations or moments. They
 * are upgraded in place rather than discarded, so an existing log survives.
 */
function normalise(session: JournalSession): JournalSession {
  const route = Array.isArray(session.route) ? session.route : [];
  const rawThemes: unknown[] = Array.isArray(session.themes)
    ? (session.themes as unknown[])
    : [];

  const themes = rawThemes
    .map((theme) => {
      if (typeof theme === 'string') return theme;
      if (typeof theme === 'object' && theme !== null) {
        const label = (theme as { label?: unknown }).label;
        if (typeof label === 'string') return label;
      }
      return null;
    })
    .filter((label): label is string => Boolean(label && label.trim()));

  const moments = (Array.isArray(session.moments) ? session.moments : [])
    .filter(
      (moment): moment is JournalMoment =>
        typeof moment === 'object' &&
        moment !== null &&
        typeof (moment as JournalMoment).label === 'string' &&
        typeof (moment as JournalMoment).atMs === 'number',
    )
    .sort((a, b) => a.atMs - b.atMs);

  return {
    ...session,
    endedAt: session.endedAt ?? null,
    durationMs: typeof session.durationMs === 'number' ? session.durationMs : 0,
    // Fall back to the first place visited so an older record still shows where.
    placeLabel:
      typeof session.placeLabel === 'string' && session.placeLabel.trim()
        ? session.placeLabel
        : (route[0]?.label ?? null),
    observations: (Array.isArray(session.observations)
      ? session.observations
      : []
    ).filter(
      (item): item is string => typeof item === 'string' && !!item.trim(),
    ),
    themes,
    moments,
    thoughts: Array.isArray(session.thoughts) ? session.thoughts : [],
    route,
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

/** Finds one session by id, or undefined when it is not in the log. */
export function findSession(id: string): JournalSession | undefined {
  return loadSessions().find((session) => session.id === id);
}

// Display formatting lives in format.ts so it stays free of storage imports.
export {
  durationLabel,
  longDateLabel,
  offsetLabel,
  relativeDayLabel,
} from './format';
