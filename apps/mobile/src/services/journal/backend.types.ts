/**
 * Storage backend contract for the Field Log.
 *
 * The journal is device-local on every platform, but the mechanism differs:
 * browsers and Expo web use `localStorage`, native iOS/Android writes a JSON
 * file into the app's document directory. Both are hidden behind this
 * synchronous interface so `storage.ts` has no platform branches.
 *
 * `persistent` must be honest: it is `false` when the backend is only holding
 * data in memory, so the UI can say so instead of implying a save.
 */

export type JournalBackend = {
  readonly id: 'file' | 'local-storage' | 'memory';
  /** True when the value survives an app restart on this device. */
  readonly persistent: boolean;
  /** Plain-language label for the Field Log, e.g. "Saved on this device only." */
  readonly label: string;
  read: () => string | null;
  write: (value: string) => void;
  clear: () => void;
};
