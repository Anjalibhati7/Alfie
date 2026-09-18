/**
 * Runtime configuration. Every privileged value is read from the server
 * environment only. Nothing in this module is ever shipped to the mobile app,
 * and no key value is ever logged — only a non-reversible fingerprint.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Config = {
  port: number;
  bosonApiKey: string | undefined;
  /** Non-reversible 8-hex fingerprint of the key, safe to log and compare. */
  bosonKeyFingerprint: string | null;
  bosonKeyLength: number;
  bosonRealtimeUrl: string;
  bosonModel: string;
  /** Extra origins allowed to open a realtime socket. Empty means same-host only. */
  allowedOrigins: string[];
  maxSessionMs: number;
  /** Which env source the key came from, for diagnosing stale or missing config. */
  keySource: 'process-env' | 'env-file' | 'none';
};

/**
 * Minimal `.env` reader.
 *
 * The service previously documented `.env` usage but never loaded one, so a key
 * placed in `.env` silently produced an upstream `Authorization: Bearer `
 * header with an empty value — which Boson rejects as an invalid key. Existing
 * process environment always wins, so shells, InstaCloud secrets, and Docker
 * continue to behave exactly as before.
 */
function loadEnvFile(): {
  values: Record<string, string>;
  path: string;
} | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.ALFIE_ENV_FILE,
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'services/agent/.env'),
    // src/ during development, dist/ when built: both sit one level under the package.
    resolve(here, '../../.env'),
    resolve(here, '../../../services/agent/.env'),
  ].filter((candidate): candidate is string => typeof candidate === 'string');

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const values: Record<string, string> = {};
      for (const rawLine of readFileSync(candidate, 'utf8').split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        // Strip matching surrounding quotes: a quoted value would otherwise
        // carry the quote characters into the credential.
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1);
        }
        if (key) values[key] = value;
      }
      return { values, path: candidate };
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/**
 * Cleans a credential. Surrounding quotes and stray whitespace are the most
 * common reason a correct-looking key is rejected as invalid.
 */
function cleanKey(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let value = raw.trim();
  for (let i = 0; i < 2; i += 1) {
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1).trim();
    }
  }
  // A key pasted from a terminal can carry a zero-width character.
  value = value.replace(/[\u200b-\u200d\ufeff]/g, '');
  return value || undefined;
}

/** Stable, non-reversible identifier so operators can compare keys safely. */
export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

function readPort(raw: string | undefined): number {
  const port = Number(raw ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const file = loadEnvFile();
  const fromProcess = cleanKey(env.BOSON_API_KEY);
  const fromFile = cleanKey(file?.values.BOSON_API_KEY);

  const bosonApiKey = fromProcess ?? fromFile;
  const keySource: Config['keySource'] =
    fromProcess !== undefined
      ? 'process-env'
      : fromFile !== undefined
        ? 'env-file'
        : 'none';

  const pick = (key: string, fallback: string): string =>
    env[key]?.trim() || file?.values[key]?.trim() || fallback;

  return {
    port: readPort(env.PORT ?? file?.values.PORT),
    bosonApiKey,
    bosonKeyFingerprint: bosonApiKey ? fingerprint(bosonApiKey) : null,
    bosonKeyLength: bosonApiKey?.length ?? 0,
    bosonRealtimeUrl: pick(
      'BOSON_REALTIME_URL',
      'wss://api.boson.ai/v1/realtime',
    ),
    bosonModel: pick('BOSON_REALTIME_MODEL', 'higgs-realtime'),
    allowedOrigins: pick('ALLOWED_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxSessionMs: readPositiveInt(
      env.MAX_SESSION_MS ?? file?.values.MAX_SESSION_MS,
      30 * 60 * 1000,
    ),
    keySource,
  };
}
