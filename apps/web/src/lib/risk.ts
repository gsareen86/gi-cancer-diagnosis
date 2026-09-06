import type { Tone } from '@/components/primitives';

/**
 * The four triage tiers.
 *
 * Derived, never stored. The database has three urgency values plus the case that triggered
 * nothing, which is exactly four states — so a stored tier could only ever disagree with the
 * flags it came from, and a migration would buy nothing.
 *
 * This module is the only place the mapping exists. Anything that needs a tone, a label, or a
 * sort position for a case's urgency comes here for it.
 */

export type Urgency = 'emergency' | 'urgent' | 'routine-but-flagged';
export type RiskTier = 'critical' | 'high' | 'moderate' | 'routine';

export const RISK_TIERS: readonly RiskTier[] = ['critical', 'high', 'moderate', 'routine'];

export function riskTier(highestUrgency: string | null | undefined): RiskTier {
  switch (highestUrgency) {
    case 'emergency':
      return 'critical';
    case 'urgent':
      return 'high';
    case 'routine-but-flagged':
      return 'moderate';
    default:
      return 'routine';
  }
}

export const RISK_TONE: Record<RiskTier, Tone> = {
  critical: 'emergency',
  high: 'urgent',
  moderate: 'caution',
  routine: 'ok',
};

/**
 * Catalogue keys, not prose. Amber (High) and yellow (Moderate) are neighbouring hues and a
 * reader in daylight may not separate them, so the word is what actually carries the tier.
 */
export const RISK_LABEL_KEY: Record<RiskTier, string> = {
  critical: 'riskCritical',
  high: 'riskHigh',
  moderate: 'riskModerate',
  routine: 'riskRoutine',
};

/** Lower sorts first. Critical waiting two days must outrank Routine waiting three. */
export const RISK_ORDER: Record<RiskTier, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  routine: 3,
};

export function compareByRisk(a: RiskTier, b: RiskTier): number {
  return RISK_ORDER[a] - RISK_ORDER[b];
}
