import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { AnswerValue, RecordedAnswer, TriggeredRedFlag } from '@gi-compass/core';
import {
  aiAssessments,
  caseAssignments,
  cases,
  doctorReviews,
  redFlagTriggers,
  responses,
  uploadedDocuments,
} from '../schema';
import type { Database } from '../client';
import { AuditWriteError, AuthorizationError, ConsentGateError, IllegalTransitionError } from '../errors';
import { authorizeCaseAccess, loadCaseIdentity } from '../access/authorize';
import { assertConsent } from '../access/consent';
import { databaseAuditWriter, type AuditOutcome, type AuditWriter } from '../access/audit';
import type { AccessContext, AccessDescriptor } from '../access/context';

/**
 * The only path to patient clinical data (design D5).
 *
 * Three things happen for every operation, in this order and without exception:
 *
 *   1. Authorization, server-side, before any clinical row is read.
 *   2. The consent gate, for the purpose named in the context.
 *   3. The work and its audit entry, inside one transaction — so a failed audit write rolls back
 *      the clinical write rather than letting it proceed unrecorded.
 *
 * A denial is audited too: an access that returns no data still leaves a record of who asked.
 */

export type CaseStatus =
  | 'in_progress'
  | 'submitted'
  | 'ai_processing'
  | 'ai_processed'
  | 'ai_skipped'
  | 'in_review'
  | 'reviewed'
  | 'released'
  | 'closed';

/**
 * The permitted case transitions. Anything not listed here is refused — in particular there is
 * no edge from `in_progress` to `released`, so a case cannot reach a patient without passing
 * through a doctor.
 */
export const CASE_TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  in_progress: ['submitted', 'closed'],
  submitted: ['ai_processing', 'ai_skipped', 'in_review', 'closed'],
  ai_processing: ['ai_processed', 'ai_skipped', 'closed'],
  ai_processed: ['in_review', 'closed'],
  ai_skipped: ['in_review', 'closed'],
  in_review: ['reviewed', 'closed'],
  reviewed: ['released', 'in_review', 'closed'],
  released: ['closed'],
  closed: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from].includes(to);
}

export interface ClinicalRepositoryOptions {
  /** Injectable so a test can prove the transaction rolls back when the audit store rejects. */
  auditWriter?: AuditWriter;
}

export class ClinicalRepository {
  readonly #db: Database;
  readonly #audit: AuditWriter;

  constructor(db: Database, options: ClinicalRepositoryOptions = {}) {
    this.#db = db;
    this.#audit = options.auditWriter ?? databaseAuditWriter;
  }

  /**
   * The funnel. Every public method below routes through here; nothing reaches a clinical table
   * any other way.
   */
  async #withAccess<T>(
    context: AccessContext,
    descriptor: AccessDescriptor,
    work: (tx: Database) => Promise<T>,
    options: { caseId?: string; skipConsent?: boolean } = {},
  ): Promise<T> {
    try {
      if (options.caseId !== undefined) {
        const identity = await loadCaseIdentity(this.#db, options.caseId);
        await authorizeCaseAccess(this.#db, context, identity);
      }
      if (options.skipConsent !== true) {
        await assertConsent(this.#db, context.subjectId, context.purpose);
      }
    } catch (error) {
      await this.#recordDenial(context, descriptor, error);
      throw error;
    }

    return this.#db.transaction(async (tx) => {
      const result = await work(tx as unknown as Database);
      await this.#writeAudit(tx as unknown as Database, context, descriptor, 'allowed');
      return result;
    });
  }

  async #writeAudit(
    tx: Database,
    context: AccessContext,
    descriptor: AccessDescriptor,
    outcome: AuditOutcome,
  ): Promise<void> {
    try {
      await this.#audit.write(tx, context, descriptor, outcome);
    } catch (error) {
      // Rethrown so the surrounding transaction rolls back. An unrecorded change to patient
      // clinical data is worse than a failed request the caller can retry.
      throw new AuditWriteError(error);
    }
  }

  /**
   * A refused access is still a fact about who reached for a patient's record, so it is logged
   * on its own — outside the rolled-back transaction, which by definition never happened.
   */
  async #recordDenial(
    context: AccessContext,
    descriptor: AccessDescriptor,
    error: unknown,
  ): Promise<void> {
    const reason =
      error instanceof AuthorizationError ? error.reason
      : error instanceof ConsentGateError ? `consent:${error.reason}`
      : 'error';
    const action =
      error instanceof ConsentGateError ? 'consent.denied' : 'authz.denied';

    try {
      await this.#audit.write(
        this.#db,
        context,
        {
          action,
          targetType: descriptor.targetType,
          targetId: descriptor.targetId,
          metadata: { attemptedAction: descriptor.action, reason },
        },
        'denied',
      );
    } catch {
      // Never let a logging failure mask the original denial; the caller must still be refused.
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Cases                                                                                     */
  /* ---------------------------------------------------------------------------------------- */

  async getCase(context: AccessContext, caseId: string) {
    return this.#withAccess(
      context,
      { action: 'case.read', targetType: 'case', targetId: caseId },
      async (tx) => {
        const [row] = await tx.select().from(cases).where(eq(cases.id, caseId)).limit(1);
        return row ?? null;
      },
      { caseId },
    );
  }

  async listResponses(context: AccessContext, caseId: string): Promise<RecordedAnswer[]> {
    return this.#withAccess(
      context,
      { action: 'response.read', targetType: 'case', targetId: caseId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(responses)
          .where(eq(responses.caseId, caseId))
          .orderBy(asc(responses.answeredAt));
        return rows.map((row) => ({
          questionId: row.questionId,
          value: row.value as AnswerValue,
          answeredAt: row.answeredAt,
          active: row.active,
        }));
      },
      { caseId },
    );
  }

  /**
   * Persists one answer, retracts anything the change stranded, and records the red flags the
   * deterministic evaluator raised — all in one transaction, so the patient is never advanced
   * past a question whose answer has not been stored.
   */
  async saveAnswer(
    context: AccessContext,
    input: {
      caseId: string;
      questionId: string;
      value: AnswerValue;
      retractedQuestionIds: readonly string[];
      redFlags: readonly TriggeredRedFlag[];
      ruleSetId: string;
    },
  ) {
    return this.#withAccess(
      context,
      {
        action: 'response.write',
        targetType: 'case',
        targetId: input.caseId,
        // The question identifier, never the answer value.
        metadata: { questionId: input.questionId, retracted: input.retractedQuestionIds.length },
      },
      async (tx) => {
        const [saved] = await tx
          .insert(responses)
          .values({
            caseId: input.caseId,
            questionId: input.questionId,
            value: input.value,
            active: true,
          })
          .onConflictDoUpdate({
            target: [responses.caseId, responses.questionId],
            set: { value: input.value, active: true, answeredAt: new Date(), retractedAt: null },
          })
          .returning();

        for (const questionId of input.retractedQuestionIds) {
          await tx
            .update(responses)
            .set({ active: false, retractedAt: new Date() })
            .where(and(eq(responses.caseId, input.caseId), eq(responses.questionId, questionId)));
        }

        for (const flag of input.redFlags) {
          await tx
            .insert(redFlagTriggers)
            .values({
              caseId: input.caseId,
              ruleSetId: input.ruleSetId,
              ruleId: flag.ruleId,
              urgency: flag.urgency,
              basisKey: flag.basisKey,
              contributingQuestionIds: [...flag.contributingQuestionIds],
            })
            .onConflictDoNothing({ target: [redFlagTriggers.caseId, redFlagTriggers.ruleId] });
        }

        await tx.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, input.caseId));
        return saved ?? null;
      },
      { caseId: input.caseId },
    );
  }

  async transitionCase(context: AccessContext, caseId: string, to: CaseStatus, patch: Record<string, unknown> = {}) {
    return this.#withAccess(
      context,
      { action: 'case.transition', targetType: 'case', targetId: caseId, metadata: { to } },
      async (tx) => {
        const [current] = await tx
          .select({ status: cases.status })
          .from(cases)
          .where(eq(cases.id, caseId))
          .limit(1);
        if (!current) throw new AuthorizationError('case does not exist', { notFound: true });
        if (!canTransition(current.status, to)) {
          throw new IllegalTransitionError(current.status, to);
        }
        const [updated] = await tx
          .update(cases)
          .set({ status: to, updatedAt: new Date(), ...patch })
          .where(eq(cases.id, caseId))
          .returning();
        return updated ?? null;
      },
      { caseId },
    );
  }

  async listRedFlags(context: AccessContext, caseId: string) {
    return this.#withAccess(
      context,
      { action: 'red_flag.read', targetType: 'case', targetId: caseId },
      async (tx) =>
        tx
          .select()
          .from(redFlagTriggers)
          .where(eq(redFlagTriggers.caseId, caseId))
          .orderBy(asc(redFlagTriggers.triggeredAt)),
      { caseId },
    );
  }

  async listDocuments(context: AccessContext, caseId: string) {
    return this.#withAccess(
      context,
      { action: 'document.read', targetType: 'case', targetId: caseId },
      async (tx) =>
        tx
          .select()
          .from(uploadedDocuments)
          .where(and(eq(uploadedDocuments.caseId, caseId), isNull(uploadedDocuments.deletedAt))),
      { caseId },
    );
  }

  /**
   * The AI assessment is readable by the assigned doctor and, under break-glass, a platform
   * admin. There is deliberately no patient-facing path to it — Decision A's default.
   *
   * TODO(confirm): Decision A — whether a patient may ever see raw AI output.
   */
  async getLatestAssessment(context: AccessContext, caseId: string) {
    if (context.actor.role === 'patient') {
      await this.#recordDenial(
        context,
        { action: 'assessment.read', targetType: 'case', targetId: caseId },
        new AuthorizationError('patients cannot read an unreleased AI assessment'),
      );
      throw new AuthorizationError('patients cannot read an unreleased AI assessment');
    }
    return this.#withAccess(
      context,
      { action: 'assessment.read', targetType: 'case', targetId: caseId },
      async (tx) => {
        const [row] = await tx
          .select()
          .from(aiAssessments)
          .where(eq(aiAssessments.caseId, caseId))
          .orderBy(desc(aiAssessments.generatedAt))
          .limit(1);
        return row ?? null;
      },
      { caseId },
    );
  }

  /** What the patient may see: only content a doctor explicitly released. */
  async getReleasedSummary(context: AccessContext, caseId: string) {
    return this.#withAccess(
      context,
      { action: 'released_summary.read', targetType: 'case', targetId: caseId },
      async (tx) => {
        const [row] = await tx
          .select({
            releasedContent: doctorReviews.releasedContent,
            releasedAt: doctorReviews.releasedAt,
          })
          .from(doctorReviews)
          .where(and(eq(doctorReviews.caseId, caseId), eq(doctorReviews.status, 'released')))
          .orderBy(desc(doctorReviews.releasedAt))
          .limit(1);
        return row ?? null;
      },
      { caseId },
    );
  }

  /** Ending an assignment ends access on the next request, not at session expiry. */
  async assignDoctor(context: AccessContext, caseId: string, doctorId: string, assignedBy: string) {
    return this.#withAccess(
      context,
      { action: 'case.assign', targetType: 'case', targetId: caseId, metadata: { doctorId } },
      async (tx) => {
        await tx
          .update(caseAssignments)
          .set({ endedAt: new Date() })
          .where(and(eq(caseAssignments.caseId, caseId), isNull(caseAssignments.endedAt)));
        const [assignment] = await tx
          .insert(caseAssignments)
          .values({ caseId, doctorId, assignedBy })
          .returning();
        await tx.update(cases).set({ assignedDoctorId: doctorId }).where(eq(cases.id, caseId));
        return assignment ?? null;
      },
      { caseId, skipConsent: context.actor.role === 'system' },
    );
  }
}
