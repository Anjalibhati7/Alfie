import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

export type Mode = 'Discover' | 'Reimagine';
export type VoiceState = 'Listening' | 'Thinking' | 'Speaking';
export type Entry = { id: string; text: string; mode: Mode };
type Session = {
  mode: Mode;
  elapsed: number;
  paused: boolean;
  active: boolean;
};
function useSessionModel() {
  const [session, setSession] = useState<Session | null>(null);
  const [voice, setVoice] = useState<VoiceState>('Listening');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const tick = useRef(0);
  const counter = useRef(0);
  useEffect(() => {
    if (!session?.active || session.paused) return;
    tick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - tick.current;
      tick.current = now;
      setSession((s) =>
        s?.active && !s.paused ? { ...s, elapsed: s.elapsed + delta } : s,
      );
    }, 250);
    return () => clearInterval(id);
  }, [session?.active, session?.paused]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active')
        setSession((s) => (s?.active ? { ...s, paused: true } : s));
    });
    return () => sub.remove();
  }, []);
  return {
    session,
    voice,
    entries,
    draft,
    setDraft,
    setVoice,
    start(mode: Mode) {
      setSession({ mode, elapsed: 0, paused: false, active: true });
      setVoice('Listening');
      setDraft('');
    },
    pause() {
      setSession((s) => (s ? { ...s, paused: !s.paused } : s));
    },
    end() {
      setSession((s) => (s ? { ...s, active: false } : s));
    },
    save() {
      const text = draft.trim();
      if (!text || !session) return false;
      setEntries((items) => [
        { id: String(++counter.current), text, mode: session.mode },
        ...items,
      ]);
      setDraft('');
      return true;
    },
    edit(id: string, text: string) {
      setEntries((items) =>
        items.map((item) =>
          item.id === id ? { ...item, text: text.trim() } : item,
        ),
      );
    },
    remove(id: string) {
      setEntries((items) => items.filter((item) => item.id !== id));
    },
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
