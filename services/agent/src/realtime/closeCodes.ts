/**
 * Higgs Realtime WebSocket close codes.
 *
 * From the Boson API reference (`/api-reference/realtime/overview`):
 *
 * | Code   | Meaning                                                                 |
 * | ------ | ----------------------------------------------------------------------- |
 * | 1000   | Normal closure, including session limits (idle timeout, max duration).   |
 * | 1013   | Max concurrency exceeded.                                               |
 * | 3000   | Invalid API key, or invalid/expired ephemeral key.                       |
 * | 4429   | Billing entitlement refused. Always preceded by an `error` event.        |
 *
 * A successful WebSocket handshake does NOT mean the credential was accepted:
 * Boson completes the upgrade and only then closes with 3000. That is why
 * "the socket opened" is not evidence that the key works.
 */

export type CloseExplanation = {
  /** Short machine-readable cause. */
  code: string;
  /** What the code means, and what to do about it. */
  message: string;
  /** True when retrying the same request could plausibly succeed. */
  recoverable: boolean;
};

export function explainClose(code: number, reason: string): CloseExplanation {
  const detail = reason.trim() ? ` Provider said: "${reason.trim()}".` : '';

  switch (code) {
    case 1000:
      return {
        code: 'session-limit',
        message: `The voice service ended the session normally.${detail}`,
        recoverable: true,
      };
    case 1013:
      return {
        code: 'upstream-concurrency',
        message: `The voice service is at its concurrency limit.${detail} Wait a moment and retry.`,
        recoverable: true,
      };
    case 3000:
      return {
        code: 'upstream-auth',
        message: `The voice service rejected the API key as invalid or expired.${detail} Check that BOSON_API_KEY on the server holds a current Boson key.`,
        recoverable: true,
      };
    case 4429:
      return {
        code: 'upstream-billing',
        message: `The voice service refused the session for billing reasons — quota exhausted, spending cap reached, or the contract ended.${detail} Check the Boson workspace balance.`,
        recoverable: true,
      };
    default:
      return {
        code: 'upstream-closed',
        message: `The voice service closed the session (close code ${code}).${detail}`,
        recoverable: true,
      };
  }
}
