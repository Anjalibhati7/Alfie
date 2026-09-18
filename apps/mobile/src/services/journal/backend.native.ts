/**
 * Native (iOS/Android) Field Log storage.
 *
 * Writes a single JSON file into the app's document directory via
 * `expo-file-system`. The document directory is durable and app-private, so no
 * permission prompt is involved and nothing is shared with other apps.
 *
 * Only Field Log content is written here — saved thoughts, session mode, date,
 * duration, derived themes, and route labels. Never audio, never a transcript,
 * never a raw coordinate, never a credential.
 *
 * Every operation is guarded: if the file system is unavailable for any reason
 * the backend degrades to memory and reports `persistent: false` rather than
 * failing a save.
 */

import { File, Paths } from 'expo-file-system';
import type { JournalBackend } from './backend.types';

const FILE_NAME = 'alfie-field-log.v1.json';

let memory: string | null = null;
let target: File | null = null;
let persistent = false;

/** Resolved once at load, so `persistent` is truthful before the first write. */
function resolveTarget(): File | null {
  try {
    const candidate = new File(Paths.document, FILE_NAME);
    // A read is the cheapest proof that the directory is present and readable.
    if (candidate.exists) void candidate.textSync();
    persistent = true;
    return candidate;
  } catch {
    persistent = false;
    return null;
  }
}

target = resolveTarget();

function writeRaw(value: string): void {
  memory = value;
  if (!target) return;
  try {
    target.write(value);
  } catch {
    try {
      target.create({ overwrite: true });
      target.write(value);
    } catch {
      // Keep the in-memory copy so the current run still behaves correctly.
      persistent = false;
    }
  }
}

function readRaw(): string | null {
  if (target) {
    try {
      if (target.exists) return target.textSync();
    } catch {
      /* fall through to the in-memory copy */
    }
  }
  return memory;
}

export function createJournalBackend(): JournalBackend {
  return {
    id: 'file',
    get persistent() {
      return persistent;
    },
    get label() {
      return persistent
        ? 'Saved on this device only. Nothing is uploaded.'
        : 'This device cannot store data, so entries last for this run only.';
    },
    read: readRaw,
    write: writeRaw,
    clear() {
      memory = null;
      if (!target) return;
      try {
        if (target.exists) target.delete();
      } catch {
        /* nothing to remove */
      }
    },
  };
}
