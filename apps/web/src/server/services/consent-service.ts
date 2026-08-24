import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  CONSENT_PURPOSES,
  summarizeConsent,
  type ConsentPurpose,
  type ConsentRecord,
} from '@gi-compass/core';
import { tables } from '@gi-compass/db';
import { database } from '../db';
import type { RequestMetadata } from '../api/request-context';

/**
 * Consent capture and withdrawal.
 *
 * Grants are immutable rows. Withdrawal stamps a timestamp; re-granting writes a new row. The
 * patient can therefore always be shown what they agreed to, when, and against which version of
 * the policy — and the record of an earlier grant survives its own withdrawal.
 */

export async function currentPolicy() {
  const [row] = await database()
    .select()
    .from(tables.consentPolicyVersions)
    .where(isNull(tables.consentPolicyVersions.supersededAt))
    .orderBy(desc(tables.consentPolicyVersions.effectiveFrom))
    .limit(1);
  if (!row) {
    // Refusing to proceed is the only safe answer: processing health data with no policy in
    // effect means the patient consented to nothing.
    throw new Error('No privacy policy version is in effect; consent cannot be captured');
  }
  return row;
}

async function loadRecords(userId: string): Promise<ConsentRecord[]> {
  const rows = await database()
    .select()
    .from(tables.consentRecords)
    .where(eq(tables.consentRecords.userId, userId));
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    purpose: row.purpose,
    policyVersion: row.policyVersion,
    grantedAt: row.grantedAt,
    withdrawnAt: row.withdrawnAt,
  }));
}

export async function consentState(userId: string) {
  const policy = await currentPolicy();
  const records = await loadRecords(userId);
  return {
    policyVersion: policy.version,
    dataFiduciary: policy.dataFiduciaryName,
    grievanceContact: policy.grievanceContact,
    purposes: summarizeConsent(records, policy.version),
  };
}

export async function grantConsent(
  userId: string,
  purposes: readonly ConsentPurpose[],
  metadata: RequestMetadata,
): Promise<void> {
  if (purposes.length === 0) return;
  const policy = await currentPolicy();
  const records = await loadRecords(userId);

  const alreadyLive = new Set(
    records
      .filter((record) => record.withdrawnAt === null && record.policyVersion === policy.version)
      .map((record) => record.purpose),
  );
  const toGrant = purposes.filter((purpose) => !alreadyLive.has(purpose));
  if (toGrant.length === 0) return;

  await database()
    .insert(tables.consentRecords)
    .values(
      toGrant.map((purpose) => ({
        userId,
        purpose,
        policyVersion: policy.version,
        policyId: policy.id,
        ipHash: metadata.ipHash,
        userAgent: metadata.userAgent,
      })),
    );
}

export async function withdrawConsent(userId: string, purpose: ConsentPurpose): Promise<number> {
  const withdrawn = await database()
    .update(tables.consentRecords)
    .set({ withdrawnAt: new Date() })
    .where(
      and(
        eq(tables.consentRecords.userId, userId),
        eq(tables.consentRecords.purpose, purpose),
        isNull(tables.consentRecords.withdrawnAt),
      ),
    )
    .returning({ id: tables.consentRecords.id });
  return withdrawn.length;
}

/** The purposes a case needs before it can be submitted for review. */
export const SUBMISSION_REQUIRED_PURPOSES: readonly ConsentPurpose[] = [
  'account_processing',
  'share_with_assigned_doctor',
];

export function isKnownPurpose(value: string): value is ConsentPurpose {
  return (CONSENT_PURPOSES as readonly string[]).includes(value);
}
