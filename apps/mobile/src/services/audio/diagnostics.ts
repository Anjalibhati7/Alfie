/**
 * TEMPORARY voice-pipeline diagnostics.
 *
 * These exist to pinpoint which stage of the audio path is failing and are
 * meant to be deleted once the pipeline is verified end to end. They log
 * metadata only — sample rates, channel counts, byte lengths, levels, and state.
 * They never log audio, base64 payloads, transcripts, or coordinates.
 *
 * Silence them with: globalThis.__ALFIE_VOICE_DEBUG__ = false
 */

type Payload = Record<string, string | number | boolean | null>;

function enabled(): boolean {
  const scope = globalThis as { __ALFIE_VOICE_DEBUG__?: boolean };
  return scope.__ALFIE_VOICE_DEBUG__ !== false;
}

export function voiceDiag(stage: string, payload: Payload = {}): void {
  if (!enabled()) return;
  console.log(`[alfie:voice] ${stage}`, payload);
}

/** Logs the first `limit` occurrences of a stage, then stays quiet. */
export function createLimitedDiag(stage: string, limit: number) {
  let seen = 0;
  return (payload: Payload = {}): void => {
    seen += 1;
    if (seen > limit) return;
    voiceDiag(stage, { ...payload, occurrence: seen });
  };
}
