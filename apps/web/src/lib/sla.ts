/**
 * The review service level.
 *
 * 48 hours from submission, per the clinical brief. A constant rather than configuration for now;
 * `openspec/changes/elevate-clinical-workspace/design.md` records the open question, which is
 * whether the threshold should tighten with risk tier — a Critical case at 40 hours is arguably
 * already breached, and treating it identically to a Routine one is the kind of thing that looks
 * defensible in a config file and indefensible in a mortality review.
 */
export const REVIEW_SLA_HOURS = 48;

const MS_PER_HOUR = 3_600_000;

export type SlaState = 'within' | 'due_soon' | 'breached';

/** Hours since the case was submitted. Negative clock skew is clamped rather than reported. */
export function hoursWaiting(since: Date | string | null, now: Date = new Date()): number {
  if (since === null) return 0;
  const at = since instanceof Date ? since : new Date(since);
  if (Number.isNaN(at.getTime())) return 0;
  return Math.max(0, (now.getTime() - at.getTime()) / MS_PER_HOUR);
}

/**
 * `due_soon` opens in the final quarter of the window. It exists so a doctor can clear a case
 * before it breaches rather than being told after the fact, which is the only version of this
 * signal that changes anyone's behaviour.
 */
export function slaState(since: Date | string | null, now: Date = new Date()): SlaState {
  if (since === null) return 'within';
  const waited = hoursWaiting(since, now);
  if (waited >= REVIEW_SLA_HOURS) return 'breached';
  if (waited >= REVIEW_SLA_HOURS * 0.75) return 'due_soon';
  return 'within';
}

export function isBreached(since: Date | string | null, now: Date = new Date()): boolean {
  return slaState(since, now) === 'breached';
}

/** Catalogue keys. As everywhere, the state is carried by a word, not only by a tone. */
export const SLA_LABEL_KEY: Record<SlaState, string> = {
  within: 'slaWithin',
  due_soon: 'slaDueSoon',
  breached: 'slaBreached',
};
