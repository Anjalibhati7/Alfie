/**
 * Web Field Log storage, used by the Expo web build.
 *
 * `localStorage` is the right mechanism here: it is device-local, survives a
 * reload, and needs no permission. Private-browsing implementations that throw
 * on write are detected once at load and degrade to memory.
 *
 * Only Field Log content is written. Never audio, never a transcript, never a
 * raw coordinate, never a credential.
 */

import type { JournalBackend } from './backend.types';

const KEY = 'alfie.field-log.v1';
const PROBE_KEY = 'alfie.storage.probe';

let memory: string | null = null;

function resolveStore(): Storage | null {
  try {
    const candidate = globalThis.localStorage;
    if (!candidate) return null;
    candidate.setItem(PROBE_KEY, '1');
    candidate.removeItem(PROBE_KEY);
    return candidate;
  } catch {
    return null;
  }
}

const store = resolveStore();

function writeRaw(value: string): void {
  memory = value;
  if (!store) return;
  try {
    store.setItem(KEY, value);
  } catch {
    // Quota or a locked-down browser: the in-memory copy still works.
  }
}

function readRaw(): string | null {
  if (store) {
    try {
      return store.getItem(KEY);
    } catch {
      /* fall through to the in-memory copy */
    }
  }
  return memory;
}

export function createJournalBackend(): JournalBackend {
  return {
    id: 'local-storage',
    persistent: store !== null,
    label: store
      ? 'Stored on this device only. Nothing is uploaded.'
      : 'This browser cannot store data, so entries last for this session only.',
    read: readRaw,
    write: writeRaw,
    clear() {
      memory = null;
      try {
        store?.removeItem(KEY);
      } catch {
        /* nothing to remove */
      }
    },
  };
}
