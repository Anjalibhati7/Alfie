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
 * Normalises a configured agent URL. A bare host such as
 * `alfie.example.instacloud.app` is assumed to be HTTPS, because a public
 * deployment is the normal production case and a schemeless value would
 * otherwise resolve as a relative path and fail confusingly.
 */
function normaliseConfigured(value: string): string {
  const trimmed = trimTrailingSlash(value);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Base HTTP URL of the Alfie agent service.
 *
 * - `EXPO_PUBLIC_AGENT_URL` wins when set. Point it at the deployed service, e.g.
 *   `EXPO_PUBLIC_AGENT_URL=https://<your-instacloud-host>` for a device build, or
 *   at a LAN address for local development: `http://192.168.1.20:8080`.
 * - Web falls back to the page's own host on port 8080, so `npm run web` works
 *   against a locally running agent with no configuration.
 * - Native without the variable falls back to `localhost`, which only works in a
 *   simulator sharing the host's network. The connection error shown in the
 *   session explains that the agent must be reachable and offers a retry.
 */
export function resolveAgentHttpUrl(): string {
  const configured = process.env.EXPO_PUBLIC_AGENT_URL?.trim();
  if (configured) return normaliseConfigured(configured);

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
