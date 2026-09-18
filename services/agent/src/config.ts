/**
 * Runtime configuration. Every privileged value is read from the server
 * environment only. Nothing in this module is ever shipped to the mobile app,
 * and no value read here is ever logged.
 */

export type Config = {
  port: number;
  bosonApiKey: string | undefined;
  bosonRealtimeUrl: string;
  bosonModel: string;
  /** Extra origins allowed to open a realtime socket. Empty means same-host only. */
  allowedOrigins: string[];
  maxSessionMs: number;
};

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
  return {
    port: readPort(env.PORT),
    bosonApiKey: env.BOSON_API_KEY?.trim() || undefined,
    bosonRealtimeUrl:
      env.BOSON_REALTIME_URL?.trim() || 'wss://api.boson.ai/v1/realtime',
    bosonModel: env.BOSON_REALTIME_MODEL?.trim() || 'higgs-realtime',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxSessionMs: readPositiveInt(env.MAX_SESSION_MS, 30 * 60 * 1000),
  };
}
