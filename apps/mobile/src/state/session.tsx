import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import {
  createRealtimeSession,
  type ConnectionStatus,
  type ConversationTurn,
  type RealtimeSession,
  type VoiceState,
} from '../services/realtime/client';
import {
  createSessionId,
  createThoughtId,
  deleteSession,
  isPersistent,
  loadSessions,
  upsertSession,
  writeSessions,
  type JournalSession,
  type JournalThought,
} from '../services/journal/storage';
import { summariseSession } from '../services/journal/summarise';
import {
  isRealLocationAvailable,
  resolveLocationProvider,
  type LocationProvider,
  type LocationStatus,
  type PlaceContext,
} from '../services/location';

export type Mode = 'Discover' | 'Reimagine';
export type { VoiceState, ConnectionStatus } from '../services/realtime/client';
export type { PlaceContext } from '../services/location';

export type LocationMode = 'demo' | 'real';

export type Session = {
  id: string;
  mode: Mode;
  startedAt: string;
  elapsed: number;
  paused: boolean;
  active: boolean;
};

function useSessionModel() {
  const [session, setSession] = useState<Session | null>(null);
  const [voice, setVoice] = useState<VoiceState>('Listening');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  /** Live microphone diagnostics, surfaced on the session screen. */
  const [capturing, setCapturing] = useState(false);
  const [level, setLevel] = useState(0);
  const [sentChunks, setSentChunks] = useState(0);
  const [receivedDeltas, setReceivedDeltas] = useState(0);
  const [closeCode, setCloseCode] = useState<number | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [sessions, setSessions] = useState<JournalSession[]>(() =>
    loadSessions(),
  );
  const [place, setPlace] = useState<PlaceContext | null>(null);
  const [trail, setTrail] = useState<PlaceContext[]>([]);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({
    kind: 'idle',
  });
  const [locationLabel, setLocationLabel] = useState('Location off');
  const [locationMode, setLocationMode] = useState<LocationMode>(() =>
    isRealLocationAvailable() ? 'real' : 'demo',
  );

  const realtime = useRef<RealtimeSession | null>(null);
  const location = useRef<LocationProvider | null>(null);
  const tick = useRef(0);
  const turnsRef = useRef<ConversationTurn[]>([]);
  const thoughtsRef = useRef<JournalThought[]>([]);
  const elapsedRef = useRef(0);
  const activeRef = useRef(false);
  const routeCount = useRef(0);
  /** Places visited, kept in a ref so finish() does not depend on render state. */
  const trailRef = useRef<PlaceContext[]>([]);
  /** When each turn happened, by turn id. Drives the timestamped Moments list. */
  const turnTimesRef = useRef<Map<string, number>>(new Map());

  /** Storage is the source of truth for the journal; React state mirrors it. */
  const patchActiveSession = useCallback(
    (patch: (current: JournalSession) => JournalSession) => {
      const current = loadSessions();
      const first = current[0];
      if (!first) return;
      setSessions(upsertSession(patch(first)));
    },
    [],
  );

  // Elapsed active time. Paused time does not count.
  useEffect(() => {
    if (!session?.active || session.paused) return;
    tick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - tick.current;
      tick.current = now;
      setSession((s) => {
        if (!s?.active || s.paused) return s;
        elapsedRef.current = s.elapsed + delta;
        return { ...s, elapsed: elapsedRef.current };
      });
    }, 250);
    return () => clearInterval(id);
  }, [session?.active, session?.paused]);

  const stopLocation = useCallback(() => {
    location.current?.stop();
    location.current = null;
    routeCount.current = 0;
  }, []);

  const startLocation = useCallback(
    async (mode: LocationMode) => {
      stopLocation();
      const provider = resolveLocationProvider(mode === 'demo');
      location.current = provider;
      routeCount.current = 0;
      provider.subscribe((snapshot) => {
        setLocationStatus(snapshot.status);
        setPlace(snapshot.place);
        setTrail(snapshot.trail);
        trailRef.current = snapshot.trail;
        setLocationLabel(provider.statusLabel());
        if (snapshot.place) realtime.current?.updateLocation(snapshot.place);
        if (activeRef.current && snapshot.trail.length !== routeCount.current) {
          routeCount.current = snapshot.trail.length;
          const route = snapshot.trail.map((point) => ({
            id: point.id,
            label: point.label,
            at: new Date().toISOString(),
            simulated: point.simulated,
          }));
          patchActiveSession((current) => ({ ...current, route }));
        }
      });
      await provider.start();
      setLocationLabel(provider.statusLabel());
    },
    [patchActiveSession, stopLocation],
  );

  const stopRealtime = useCallback(() => {
    realtime.current?.stop();
    realtime.current = null;
  }, []);

  // Auto-pause when the app leaves the foreground: never listen in the
  // background, and never leave a session running unattended.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setSession((s) => (s?.active ? { ...s, paused: true } : s));
        realtime.current?.setPaused(true);
      }
    });
    return () => sub.remove();
  }, []);

  const finish = useCallback(() => {
    activeRef.current = false;
    stopRealtime();
    stopLocation();
    const captured = turnsRef.current;
    const capturedThoughts = thoughtsRef.current;
    const duration = elapsedRef.current;

    // The conversation is turned into a memory of the outing here, and then
    // dropped. The transcript is never written to the Field Log.
    const summary = summariseSession(captured, turnTimesRef.current);
    const place = trailRef.current[0];

    patchActiveSession((current) => ({
      ...current,
      endedAt: new Date().toISOString(),
      durationMs: duration,
      placeLabel: place?.area ?? place?.label ?? null,
      observations: summary.observations,
      themes: summary.themes,
      moments: summary.moments,
      thoughts: capturedThoughts.length ? capturedThoughts : current.thoughts,
    }));

    // Discard the transcript and its timings.
    turnsRef.current = [];
    turnTimesRef.current = new Map();
    setTurns([]);

    setSession((s) => (s ? { ...s, active: false, paused: false } : s));
    setAnnouncement('Session ended. Your Field Log is ready.');
  }, [patchActiveSession, stopLocation, stopRealtime]);

  const start = useCallback(
    (mode: Mode) => {
      const id = createSessionId();
      const startedAt = new Date().toISOString();
      turnsRef.current = [];
      thoughtsRef.current = [];
      turnTimesRef.current = new Map();
      trailRef.current = [];
      elapsedRef.current = 0;
      activeRef.current = true;
      routeCount.current = 0;
      setSession({
        id,
        mode,
        startedAt,
        elapsed: 0,
        paused: false,
        active: true,
      });
      setVoice('Listening');
      setError(null);
      setStatus('connecting');
      setTurns([]);
      setDraft('');
      setAnnouncement('');
      setTrail([]);
      setPlace(null);
      setSessions(
        upsertSession({
          id,
          mode,
          startedAt,
          endedAt: null,
          durationMs: 0,
          placeLabel: null,
          observations: [],
          themes: [],
          moments: [],
          thoughts: [],
          route: [],
          voiceTurns: 0,
          simulatedLocation: locationMode === 'demo',
        }),
      );

      const live = createRealtimeSession(mode, {
        onState: (state) => {
          setStatus(state.status);
          setVoice(state.voice);
          setError(state.error?.message ?? null);
          setCapturing(state.capturing);
          setLevel(state.level);
          setSentChunks(state.sentChunks);
          setReceivedDeltas(state.receivedDeltas);
          setCloseCode(state.closeCode);
        },
        onTurns: (next) => {
          // Stamp each turn with its offset into the session the first time it
          // appears, so Moments can be placed along the walk.
          for (const turn of next) {
            if (!turnTimesRef.current.has(turn.id)) {
              turnTimesRef.current.set(turn.id, elapsedRef.current);
            }
          }
          turnsRef.current = next;
          setTurns(next);
          const assistantTurns = next.filter(
            (turn) => turn.role === 'assistant',
          ).length;
          patchActiveSession((current) => ({
            ...current,
            voiceTurns: assistantTurns,
          }));
        },
        onAnnouncement: (message) => setAnnouncement(message),
      });
      realtime.current = live;
      void live.start();
      void startLocation(locationMode);
    },
    [locationMode, patchActiveSession, startLocation],
  );

  const pause = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      const paused = !s.paused;
      realtime.current?.setPaused(paused);
      setAnnouncement(
        paused ? 'Session paused. The microphone is off.' : 'Session resumed.',
      );
      return { ...s, paused };
    });
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setAnnouncement('Reconnecting.');
    void realtime.current?.start();
  }, []);

  const interrupt = useCallback(() => {
    realtime.current?.interrupt();
  }, []);

  const changeLocationMode = useCallback(
    (mode: LocationMode) => {
      setLocationMode(mode);
      if (session?.active) {
        void startLocation(mode);
        setAnnouncement(
          mode === 'demo'
            ? 'Using the simulated demo route.'
            : 'Using this device’s approximate location.',
        );
      }
    },
    [session?.active, startLocation],
  );

  const save = useCallback(() => {
    const text = draft.trim();
    if (!text || !session) return false;
    const thought: JournalThought = {
      id: createThoughtId(),
      text,
      createdAt: new Date().toISOString(),
    };
    thoughtsRef.current = [thought, ...thoughtsRef.current];
    patchActiveSession((current) => ({
      ...current,
      thoughts: [thought, ...current.thoughts],
    }));
    setDraft('');
    return true;
  }, [draft, patchActiveSession, session]);

  const editThought = useCallback((id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = loadSessions();
    const next = current.map((item) =>
      item.thoughts.some((thought) => thought.id === id)
        ? {
            ...item,
            thoughts: item.thoughts.map((thought) =>
              thought.id === id ? { ...thought, text: trimmed } : thought,
            ),
          }
        : item,
    );
    setSessions(writeSessions(next));
    thoughtsRef.current = thoughtsRef.current.map((thought) =>
      thought.id === id ? { ...thought, text: trimmed } : thought,
    );
  }, []);

  const removeThought = useCallback((id: string) => {
    const current = loadSessions();
    const next = current.map((item) => ({
      ...item,
      thoughts: item.thoughts.filter((thought) => thought.id !== id),
    }));
    setSessions(writeSessions(next));
    thoughtsRef.current = thoughtsRef.current.filter(
      (thought) => thought.id !== id,
    );
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions(deleteSession(id));
  }, []);

  const allThoughts = useMemo(
    () =>
      sessions.flatMap((item) =>
        item.thoughts.map((thought) => ({
          ...thought,
          mode: item.mode,
          sessionId: item.id,
        })),
      ),
    [sessions],
  );

  useEffect(
    () => () => {
      activeRef.current = false;
      realtime.current?.stop();
      location.current?.stop();
    },
    [],
  );

  return {
    session,
    voice,
    status,
    capturing,
    level,
    sentChunks,
    receivedDeltas,
    closeCode,
    error,
    turns,
    allThoughts,
    draft,
    sessions,
    place,
    trail,
    locationStatus,
    locationLabel,
    locationMode,
    persistent: isPersistent(),
    announcement,
    setDraft,
    setAnnouncement,
    start,
    pause,
    end: finish,
    retry,
    interrupt,
    save,
    editThought,
    removeThought,
    removeSession,
    changeLocationMode,
  };
}

const SessionContext = createContext<ReturnType<typeof useSessionModel> | null>(
  null,
);

export function SessionProvider({ children }: PropsWithChildren) {
  return (
    <SessionContext.Provider value={useSessionModel()}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is required');
  return value;
}

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
