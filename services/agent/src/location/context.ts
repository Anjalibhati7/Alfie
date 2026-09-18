/**
 * Place context shared with the model.
 *
 * Only coarse, user-consented context reaches this service. Coordinates are
 * rounded before they are used, never logged, and never stored.
 */

export type LocationContext = {
  /** Stable id used for change detection, e.g. "demo-3". */
  id: string;
  /** Human label of where the user is. Never a raw coordinate string. */
  label: string;
  detail?: string;
  activity?: 'still' | 'walking';
  simulated: boolean;
};

export function parseLocationContext(input: unknown): LocationContext | null {
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.label !== 'string' || !record.label.trim()) return null;
  const activity =
    record.activity === 'still' || record.activity === 'walking'
      ? record.activity
      : undefined;
  return {
    id: record.id.trim().slice(0, 64),
    label: record.label.trim().slice(0, 120),
    detail:
      typeof record.detail === 'string'
        ? record.detail.trim().slice(0, 240)
        : undefined,
    activity,
    simulated: record.simulated === true,
  };
}

/**
 * Short, honest description of where the user is. The model is instructed to
 * never invent place facts, so this text deliberately avoids naming venues.
 */
export function describeLocation(context: LocationContext): string {
  const parts = [`Where you are: ${context.label}`];
  if (context.detail) parts.push(context.detail);
  if (context.activity) parts.push(`Movement: ${context.activity}.`);
  if (context.simulated) {
    parts.push(
      'This location is simulated for a demo, indoors. Treat it as approximate and never claim you can see the user.',
    );
  }
  return parts.join('\n');
}
