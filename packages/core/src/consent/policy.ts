import { z } from 'zod';

/**
 * Consent is a first-class, versioned, per-purpose, revocable object — never a boolean
 * (DPDP Act 2023 / DPDP Rules 2025). Records are immutable: withdrawal stamps a timestamp,
 * re-granting writes a new record, and history survives both.
 */

export const consentPurposeSchema = z.enum([
  /** Holding the account and the clinical record itself. Without it, nothing can be stored. */
  'account_processing',
  /** Sending clinical content to the AI pipeline and any external model provider. */
  'ai_assisted_analysis',
  /** Making the case readable by the assigned reviewing doctor. */
  'share_with_assigned_doctor',
]);
export type ConsentPurpose = z.infer<typeof consentPurposeSchema>;

export const CONSENT_PURPOSES = consentPurposeSchema.options;

/** What the patient is told withdrawal will stop. Rendered from the i18n catalogue. */
export const CONSENT_PURPOSE_COPY: Record<
  ConsentPurpose,
  { titleKey: string; explanationKey: string; withdrawalConsequenceKey: string; required: boolean }
> = {
  account_processing: {
    titleKey: 'consent.account_processing.title',
    explanationKey: 'consent.account_processing.explanation',
    withdrawalConsequenceKey: 'consent.account_processing.withdrawal',
    required: true,
  },
  ai_assisted_analysis: {
    titleKey: 'consent.ai_assisted_analysis.title',
    explanationKey: 'consent.ai_assisted_analysis.explanation',
    withdrawalConsequenceKey: 'consent.ai_assisted_analysis.withdrawal',
    required: false,
  },
  share_with_assigned_doctor: {
    titleKey: 'consent.share_with_assigned_doctor.title',
    explanationKey: 'consent.share_with_assigned_doctor.explanation',
    withdrawalConsequenceKey: 'consent.share_with_assigned_doctor.withdrawal',
    required: false,
  },
};

export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  /** The exact policy document version the patient was shown when they granted. */
  policyVersion: string;
  grantedAt: Date;
  withdrawnAt: Date | null;
}

export type ConsentDenialReason = 'never_granted' | 'withdrawn' | 'superseded_policy_version';

export type ConsentDecision =
  | { granted: true; record: ConsentRecord }
  | { granted: false; reason: ConsentDenialReason; purpose: ConsentPurpose };

/**
 * Decides whether a purpose may be processed right now.
 *
 * A grant against a superseded policy version does not carry forward: the patient consented
 * to what that version said, so processing pauses until they accept the current one.
 */
export function decideConsent(
  purpose: ConsentPurpose,
  records: readonly ConsentRecord[],
  currentPolicyVersion: string,
): ConsentDecision {
  const forPurpose = records
    .filter((record) => record.purpose === purpose)
    .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());

  if (forPurpose.length === 0) {
    return { granted: false, reason: 'never_granted', purpose };
  }

  const live = forPurpose.filter((record) => record.withdrawnAt === null);
  if (live.length === 0) {
    return { granted: false, reason: 'withdrawn', purpose };
  }

  const current = live.find((record) => record.policyVersion === currentPolicyVersion);
  if (!current) {
    return { granted: false, reason: 'superseded_policy_version', purpose };
  }

  return { granted: true, record: current };
}

export function hasConsent(
  purpose: ConsentPurpose,
  records: readonly ConsentRecord[],
  currentPolicyVersion: string,
): boolean {
  return decideConsent(purpose, records, currentPolicyVersion).granted;
}

/** Thrown by the data-access layer when a caller reaches clinical data without a live grant. */
export class ConsentRequiredError extends Error {
  readonly purpose: ConsentPurpose;
  readonly reason: ConsentDenialReason;

  constructor(purpose: ConsentPurpose, reason: ConsentDenialReason) {
    super(`Processing for purpose "${purpose}" is not permitted: ${reason}`);
    this.name = 'ConsentRequiredError';
    this.purpose = purpose;
    this.reason = reason;
  }
}

/** The consent state the patient sees in their privacy settings. */
export interface ConsentSummaryItem {
  purpose: ConsentPurpose;
  granted: boolean;
  reason: ConsentDenialReason | null;
  grantedAt: Date | null;
  policyVersion: string | null;
  titleKey: string;
  explanationKey: string;
  withdrawalConsequenceKey: string;
  required: boolean;
}

export function summarizeConsent(
  records: readonly ConsentRecord[],
  currentPolicyVersion: string,
): ConsentSummaryItem[] {
  return CONSENT_PURPOSES.map((purpose) => {
    const decision = decideConsent(purpose, records, currentPolicyVersion);
    const copy = CONSENT_PURPOSE_COPY[purpose];
    return {
      purpose,
      granted: decision.granted,
      reason: decision.granted ? null : decision.reason,
      grantedAt: decision.granted ? decision.record.grantedAt : null,
      policyVersion: decision.granted ? decision.record.policyVersion : null,
      ...copy,
    };
  });
}
