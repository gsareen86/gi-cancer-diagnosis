import { and, desc, eq, isNull } from 'drizzle-orm';
import { decideConsent, type ConsentPurpose, type ConsentRecord } from '@gi-compass/core';
import { consentPolicyVersions, consentRecords } from '../schema';
import { ConsentGateError } from '../errors';
import type { Database } from '../client';

/**
 * The consent gate. It runs inside the repository, immediately before any clinical row is
 * fetched, so no caller can reach the data by skipping it.
 */

/**
 * The policy version currently in effect. A database with no live privacy policy must not
 * process anything, so the absence of one is an error rather than a permissive default.
 */
export async function currentPolicyVersion(db: Database): Promise<string> {
  const [row] = await db
    .select({ version: consentPolicyVersions.version })
    .from(consentPolicyVersions)
    .where(isNull(consentPolicyVersions.supersededAt))
    .orderBy(desc(consentPolicyVersions.effectiveFrom))
    .limit(1);

  if (!row) throw new ConsentGateError('*', 'no privacy policy version is in effect');
  return row.version;
}

export async function loadConsentRecords(
  db: Database,
  userId: string,
  purpose?: ConsentPurpose,
): Promise<ConsentRecord[]> {
  const where =
    purpose === undefined
      ? eq(consentRecords.userId, userId)
      : and(eq(consentRecords.userId, userId), eq(consentRecords.purpose, purpose));

  const rows = await db.select().from(consentRecords).where(where);
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    purpose: row.purpose,
    policyVersion: row.policyVersion,
    grantedAt: row.grantedAt,
    withdrawnAt: row.withdrawnAt,
  }));
}

/**
 * Throws unless the subject holds a live grant for this purpose against the current policy
 * version. Called before the clinical query, never after.
 */
export async function assertConsent(
  db: Database,
  subjectId: string,
  purpose: ConsentPurpose,
): Promise<void> {
  const [policyVersion, records] = await Promise.all([
    currentPolicyVersion(db),
    loadConsentRecords(db, subjectId, purpose),
  ]);
  const decision = decideConsent(purpose, records, policyVersion);
  if (!decision.granted) {
    throw new ConsentGateError(purpose, decision.reason);
  }
}

export async function hasConsentFor(
  db: Database,
  subjectId: string,
  purpose: ConsentPurpose,
): Promise<boolean> {
  try {
    await assertConsent(db, subjectId, purpose);
    return true;
  } catch (error) {
    if (error instanceof ConsentGateError) return false;
    throw error;
  }
}
