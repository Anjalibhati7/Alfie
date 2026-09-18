/**
 * Where the voice service lives.
 *
 * Only public configuration is read here. `EXPO_PUBLIC_*` values are compiled
 * into the app bundle, so they must never contain credentials. The Boson key
 * lives exclusively on the agent service.
 */

const DEFAULT_PORT = 8080;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Base HTTP URL of the Alfie agent service.
 *
 * - Web: reuse the page's host so `npm run web` works with no configuration.
 * - Native: set `EXPO_PUBLIC_AGENT_URL` to the machine running the agent, e.g.
 *   `EXPO_PUBLIC_AGENT_URL=http://192.168.1.20:8080 npm run mobile`.
 */
export function resolveAgentHttpUrl(): string {
  const configured = process.env.EXPO_PUBLIC_AGENT_URL?.trim();
  if (configured) return trimTrailingSlash(configured);

  const location = globalThis.location;
  if (location?.hostname) {
    const scheme = location.protocol === 'https:' ? 'https' : 'http';
    return `${scheme}://${location.hostname}:${DEFAULT_PORT}`;
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

export function resolveRealtimeUrl(mode: string): string {
  const base = resolveAgentHttpUrl().replace(/^http/, 'ws');
  return `${base}/realtime?mode=${encodeURIComponent(mode)}`;
}

/** True when the operator has explicitly pointed the app at an agent service. */
export function isAgentConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_AGENT_URL?.trim());
}
