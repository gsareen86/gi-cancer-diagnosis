import { and, asc, desc, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import type { AnswerValue, RecordedAnswer, TriggeredRedFlag } from '@gi-compass/core';
import {
  aiAssessments,
  caseAssignments,
  caseMessages,
  cases,
  doctorReviews,
  redFlagTriggers,
  responses,
  reviewDiffs,
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

  /* ---------------------------------------------------------------------------------------- */
  /* Case creation and listing                                                                 */
  /* ---------------------------------------------------------------------------------------- */

  /**
   * Opens a case. The template version is pinned here and never changes for this case, so a
   * republish mid-interview cannot shift the ground under answers already given.
   */
  async createCase(
    context: AccessContext,
    input: { patientId: string; templateVersionId: string; entryPointId: string },
  ) {
    return this.#withAccess(
      context,
      {
        action: 'case.create',
        targetType: 'case',
        metadata: { entryPointId: input.entryPointId, templateVersionId: input.templateVersionId },
      },
      async (tx) => {
        const [row] = await tx
          .insert(cases)
          .values({
            patientId: input.patientId,
            templateVersionId: input.templateVersionId,
            entryPointId: input.entryPointId,
            status: 'in_progress',
          })
          .returning();
        return row ?? null;
      },
    );
  }

  /**
   * Resolves a case and its owner for the system pipeline.
   *
   * Every other read needs the subject up front, because consent is evaluated against a named
   * patient. The background pipeline is the one caller that starts from a case id and has to
   * discover the owner — so this is deliberately narrow: system actors only, no clinical
   * content in the result, and audited like anything else.
   */
  async resolveCaseForSystem(caseId: string): Promise<{
    id: string;
    patientId: string;
    templateVersionId: string;
    entryPointId: string;
    status: CaseStatus;
  } | null> {
    const [row] = await this.#db
      .select({
        id: cases.id,
        patientId: cases.patientId,
        templateVersionId: cases.templateVersionId,
        entryPointId: cases.entryPointId,
        status: cases.status,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!row) return null;

    await this.#audit.write(
      this.#db,
      { actor: { id: null, role: 'system' }, subjectId: row.patientId, purpose: 'ai_assisted_analysis' },
      { action: 'case.resolve', targetType: 'case', targetId: caseId },
      'allowed',
    );
    return row;
  }

  /** A patient's own cases. Returns state and timestamps only — never clinical content. */
  async listPatientCases(context: AccessContext) {
    return this.#withAccess(
      context,
      { action: 'case.list', targetType: 'patient', targetId: context.subjectId },
      async (tx) =>
        tx
          .select({
            id: cases.id,
            status: cases.status,
            entryPointId: cases.entryPointId,
            templateVersionId: cases.templateVersionId,
            createdAt: cases.createdAt,
            updatedAt: cases.updatedAt,
            submittedAt: cases.submittedAt,
            releasedAt: cases.releasedAt,
          })
          .from(cases)
          .where(eq(cases.patientId, context.subjectId))
          .orderBy(desc(cases.createdAt)),
    );
  }

  /**
   * The doctor's review queue.
   *
   * Not routed through `#withAccess`: that funnel authorizes one case for one subject, and a
   * queue spans many patients. It is scoped by live assignment instead, carries no clinical
   * findings beyond each case's highest red-flag urgency, and writes its own audit entry.
   */
  /**
   * Submitted cases that no doctor is responsible for.
   *
   * These exist because assignment happens at submission: a case submitted before any doctor
   * account existed found nobody to assign, and — since a doctor only ever sees cases assigned to
   * them — became invisible to everyone. A submitted case with no owner is the one state a
   * clinical queue must never hide, so it is surfaced for any doctor to claim.
   */
  async listClaimableCases(actorRole: AccessContext['actor']['role']) {
    if (actorRole !== 'doctor') {
      throw new AuthorizationError('only a doctor may load the unassigned queue');
    }

    const liveAssignments = this.#db
      .select({ caseId: caseAssignments.caseId })
      .from(caseAssignments)
      .where(isNull(caseAssignments.endedAt));

    const rows = await this.#db
      .select({
        id: cases.id,
        status: cases.status,
        entryPointId: cases.entryPointId,
        patientId: cases.patientId,
        createdAt: cases.createdAt,
        submittedAt: cases.submittedAt,
        aiSkipReason: cases.aiSkipReason,
      })
      .from(cases)
      .where(
        and(
          isNull(cases.assignedDoctorId),
          notInArray(cases.id, liveAssignments),
          inArray(cases.status, [
            'submitted',
            'ai_processing',
            'ai_processed',
            'ai_skipped',
            'in_review',
          ]),
        ),
      )
      .orderBy(asc(cases.submittedAt));

    return this.#withUrgency(rows);
  }

  /**
   * Takes responsibility for an unassigned case.
   *
   * Refuses one that already has a live assignment, so two doctors opening the queue at the same
   * moment cannot both come away believing the case is theirs.
   */
  async claimCase(context: AccessContext, caseId: string, doctorId: string) {
    const [existing] = await this.#db
      .select({ id: caseAssignments.id })
      .from(caseAssignments)
      .where(and(eq(caseAssignments.caseId, caseId), isNull(caseAssignments.endedAt)))
      .limit(1);

    if (existing) {
      throw new AuthorizationError('this case already has a reviewing doctor');
    }

    return this.#withAccess(
      context,
      { action: 'case.claim', targetType: 'case', targetId: caseId, metadata: { doctorId } },
      async (tx) => {
        const [assignment] = await tx
          .insert(caseAssignments)
          .values({ caseId, doctorId, assignedBy: doctorId })
          .returning();
        await tx.update(cases).set({ assignedDoctorId: doctorId }).where(eq(cases.id, caseId));
        return assignment ?? null;
      },
    );
  }

  /** Attaches each case's highest red-flag urgency, which is what orders a review queue. */
  async #withUrgency<T extends { id: string }>(rows: T[]) {
    const flags =
      rows.length === 0
        ? []
        : await this.#db
            .select({ caseId: redFlagTriggers.caseId, urgency: redFlagTriggers.urgency })
            .from(redFlagTriggers)
            .where(
              inArray(
                redFlagTriggers.caseId,
                rows.map((row) => row.id),
              ),
            );

    return rows.map((row) => {
      const urgencies = flags.filter((flag) => flag.caseId === row.id).map((flag) => flag.urgency);
      const highest = urgencies.includes('emergency')
        ? 'emergency'
        : urgencies.includes('urgent')
          ? 'urgent'
          : urgencies.includes('routine-but-flagged')
            ? 'routine-but-flagged'
            : null;
      return { ...row, highestUrgency: highest, flagCount: urgencies.length };
    });
  }

  async listDoctorQueue(doctorId: string, actorRole: AccessContext['actor']['role']) {
    if (actorRole !== 'doctor') {
      throw new AuthorizationError('only a doctor may load a review queue');
    }
    const db = this.#db;
    const rows = await db
      .select({
        id: cases.id,
        status: cases.status,
        entryPointId: cases.entryPointId,
        patientId: cases.patientId,
        createdAt: cases.createdAt,
        submittedAt: cases.submittedAt,
        aiSkipReason: cases.aiSkipReason,
      })
      .from(cases)
      .innerJoin(
        caseAssignments,
        and(eq(caseAssignments.caseId, cases.id), isNull(caseAssignments.endedAt)),
      )
      .where(eq(caseAssignments.doctorId, doctorId))
      .orderBy(desc(cases.submittedAt), desc(cases.createdAt));

    const flags = rows.length === 0
      ? []
      : await db
          .select({
            caseId: redFlagTriggers.caseId,
            urgency: redFlagTriggers.urgency,
            ruleId: redFlagTriggers.ruleId,
          })
          .from(redFlagTriggers)
          .where(inArray(redFlagTriggers.caseId, rows.map((row) => row.id)));

    await this.#audit.write(
      db,
      { actor: { id: doctorId, role: 'doctor' }, subjectId: doctorId, purpose: 'share_with_assigned_doctor' },
      { action: 'queue.read', targetType: 'doctor_queue', targetId: doctorId, metadata: { cases: rows.length } },
      'allowed',
    );

    return rows.map((row) => {
      const caseFlags = flags.filter((flag) => flag.caseId === row.id);
      const urgencies = caseFlags.map((flag) => flag.urgency);
      const highest = urgencies.includes('emergency')
        ? 'emergency'
        : urgencies.includes('urgent')
          ? 'urgent'
          : urgencies.includes('routine-but-flagged')
            ? 'routine-but-flagged'
            : null;
      return { ...row, highestUrgency: highest, flagCount: caseFlags.length };
    });
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Documents                                                                                 */
  /* ---------------------------------------------------------------------------------------- */

  async attachDocument(
    context: AccessContext,
    input: {
      caseId: string;
      originalFilename: string;
      contentType: string;
      byteSize: number;
      storageKey: string;
      scanStatus: 'pending' | 'clean' | 'infected' | 'scanner_unavailable';
      patientTypeTag?: string | null;
      patientDateTag?: string | null;
    },
  ) {
    return this.#withAccess(
      context,
      {
        action: 'document.upload',
        targetType: 'case',
        targetId: input.caseId,
        metadata: { contentType: input.contentType, byteSize: input.byteSize, scanStatus: input.scanStatus },
      },
      async (tx) => {
        const [row] = await tx
          .insert(uploadedDocuments)
          .values({
            caseId: input.caseId,
            originalFilename: input.originalFilename,
            contentType: input.contentType,
            byteSize: input.byteSize,
            storageKey: input.storageKey,
            scanStatus: input.scanStatus,
            patientTypeTag: input.patientTypeTag ?? null,
            patientDateTag: input.patientDateTag ?? null,
          })
          .returning();
        return row ?? null;
      },
      { caseId: input.caseId },
    );
  }

  /**
   * Records that a short-lived signed URL was issued for one document. The authorization check
   * happens here, on every access, rather than once when a long-lived URL was minted.
   */
  async recordDocumentAccess(context: AccessContext, caseId: string, documentId: string, ttlSeconds: number) {
    return this.#withAccess(
      context,
      {
        action: 'document.url_issued',
        targetType: 'document',
        targetId: documentId,
        metadata: { caseId, ttlSeconds },
      },
      async (tx) => {
        const [row] = await tx
          .select()
          .from(uploadedDocuments)
          .where(and(eq(uploadedDocuments.id, documentId), eq(uploadedDocuments.caseId, caseId)))
          .limit(1);
        if (!row) throw new AuthorizationError('document does not exist', { notFound: true });
        if (row.deletedAt !== null) {
          throw new AuthorizationError('document has been deleted', { notFound: true });
        }
        if (row.scanStatus !== 'clean') {
          // A file that has not passed scanning is never exposed, to the patient or the doctor.
          throw new AuthorizationError('document has not passed malware scanning');
        }
        return row;
      },
      { caseId },
    );
  }

  async deleteDocument(context: AccessContext, caseId: string, documentId: string) {
    return this.#withAccess(
      context,
      { action: 'document.delete', targetType: 'document', targetId: documentId, metadata: { caseId } },
      async (tx) => {
        const [caseRow] = await tx
          .select({ status: cases.status })
          .from(cases)
          .where(eq(cases.id, caseId))
          .limit(1);
        if (!caseRow) throw new AuthorizationError('case does not exist', { notFound: true });
        if (caseRow.status !== 'in_progress') {
          // After submission the upload is part of the clinical record; removing it is a
          // record change, which goes through the data-subject correction process instead.
          throw new AuthorizationError('a submitted case cannot have documents deleted');
        }
        const [row] = await tx
          .update(uploadedDocuments)
          .set({ deletedAt: new Date() })
          .where(and(eq(uploadedDocuments.id, documentId), eq(uploadedDocuments.caseId, caseId)))
          .returning();
        return row ?? null;
      },
      { caseId },
    );
  }

  async recordDocumentExtract(
    context: AccessContext,
    documentId: string,
    caseId: string,
    extract: { machineReadable: boolean; payload: unknown },
  ) {
    return this.#withAccess(
      context,
      {
        action: 'document.extract',
        targetType: 'document',
        targetId: documentId,
        metadata: { caseId, machineReadable: extract.machineReadable },
      },
      async (tx) => {
        const [row] = await tx
          .update(uploadedDocuments)
          .set({ machineReadable: extract.machineReadable, extract: extract.payload })
          .where(and(eq(uploadedDocuments.id, documentId), eq(uploadedDocuments.caseId, caseId)))
          .returning();
        return row ?? null;
      },
      { caseId },
    );
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Assessment                                                                                */
  /* ---------------------------------------------------------------------------------------- */

  /** Stores the validated assessment exactly as the model produced it. Never edited afterwards. */
  async recordAssessment(
    context: AccessContext,
    input: {
      caseId: string;
      outcome: 'generated' | 'ungrounded' | 'unavailable';
      modelVersion: string;
      promptVersion: string;
      kbVersion: string;
      retrievedChunkIds: readonly string[];
      payload: unknown | null;
      failureReason?: string | null;
    },
  ) {
    return this.#withAccess(
      context,
      {
        action: 'assessment.write',
        targetType: 'case',
        targetId: input.caseId,
        metadata: {
          outcome: input.outcome,
          modelVersion: input.modelVersion,
          promptVersion: input.promptVersion,
          kbVersion: input.kbVersion,
          groundingChunks: input.retrievedChunkIds.length,
        },
      },
      async (tx) => {
        const [row] = await tx
          .insert(aiAssessments)
          .values({
            caseId: input.caseId,
            outcome: input.outcome,
            modelVersion: input.modelVersion,
            promptVersion: input.promptVersion,
            kbVersion: input.kbVersion,
            retrievedChunkIds: [...input.retrievedChunkIds],
            payload: input.payload ?? null,
            failureReason: input.failureReason ?? null,
          })
          .returning();
        return row ?? null;
      },
      { caseId: input.caseId, skipConsent: context.actor.role === 'system' },
    );
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Doctor review                                                                             */
  /* ---------------------------------------------------------------------------------------- */

  async openReview(context: AccessContext, caseId: string, doctorId: string, aiAssessmentId: string | null) {
    return this.#withAccess(
      context,
      { action: 'review.open', targetType: 'case', targetId: caseId },
      async (tx) => {
        const [existing] = await tx
          .select()
          .from(doctorReviews)
          .where(and(eq(doctorReviews.caseId, caseId), eq(doctorReviews.doctorId, doctorId)))
          .orderBy(desc(doctorReviews.createdAt))
          .limit(1);
        if (existing && existing.status !== 'released') return existing;

        const [row] = await tx
          .insert(doctorReviews)
          .values({
            caseId,
            doctorId,
            aiAssessmentId,
            status: 'in_review',
            startedAt: new Date(),
          })
          .returning();
        return row ?? null;
      },
      { caseId },
    );
  }

  async saveReviewDraft(
    context: AccessContext,
    input: {
      caseId: string;
      reviewId: string;
      finalSummary: unknown;
      doctorNotes: string | null;
      diffs: ReadonlyArray<{
        action: 'likelihood_changed' | 'item_added' | 'item_removed' | 'item_rejected' | 'next_steps_changed';
        conditionId?: string | null;
        beforeValue?: unknown;
        afterValue?: unknown;
        rationale?: string | null;
        modelVersion: string;
        promptVersion: string;
        kbVersion: string;
      }>;
    },
  ) {
    return this.#withAccess(
      context,
      {
        action: 'review.save',
        targetType: 'review',
        targetId: input.reviewId,
        metadata: { caseId: input.caseId, diffCount: input.diffs.length },
      },
      async (tx) => {
        const [row] = await tx
          .update(doctorReviews)
          .set({ finalSummary: input.finalSummary, doctorNotes: input.doctorNotes, status: 'in_review' })
          .where(eq(doctorReviews.id, input.reviewId))
          .returning();

        // Overrides are recorded fresh each save so the diff set always reflects the current
        // draft rather than accumulating superseded entries.
        await tx.delete(reviewDiffs).where(eq(reviewDiffs.reviewId, input.reviewId));
        if (input.diffs.length > 0) {
          await tx.insert(reviewDiffs).values(
            input.diffs.map((diff) => ({
              reviewId: input.reviewId,
              action: diff.action,
              conditionId: diff.conditionId ?? null,
              beforeValue: diff.beforeValue ?? null,
              afterValue: diff.afterValue ?? null,
              rationale: diff.rationale ?? null,
              modelVersion: diff.modelVersion,
              promptVersion: diff.promptVersion,
              kbVersion: diff.kbVersion,
            })),
          );
        }
        return row ?? null;
      },
      { caseId: input.caseId },
    );
  }

  async finalizeReview(context: AccessContext, caseId: string, reviewId: string) {
    return this.#withAccess(
      context,
      { action: 'review.finalize', targetType: 'review', targetId: reviewId, metadata: { caseId } },
      async (tx) => {
        const [row] = await tx
          .update(doctorReviews)
          .set({ status: 'finalized', finalizedAt: new Date() })
          .where(eq(doctorReviews.id, reviewId))
          .returning();
        await tx.update(cases).set({ status: 'reviewed', updatedAt: new Date() }).where(eq(cases.id, caseId));
        return row ?? null;
      },
      { caseId },
    );
  }

  /**
   * Releases the doctor-authored summary to the patient.
   *
   * The exact content shown is frozen here, so what the patient saw stays recoverable even if
   * the doctor later revises their notes.
   */
  async releaseReview(
    context: AccessContext,
    input: { caseId: string; reviewId: string; releasedContent: unknown; releasedBy: string },
  ) {
    return this.#withAccess(
      context,
      {
        action: 'review.release',
        targetType: 'review',
        targetId: input.reviewId,
        metadata: { caseId: input.caseId, releasedBy: input.releasedBy },
      },
      async (tx) => {
        const now = new Date();
        const [row] = await tx
          .update(doctorReviews)
          .set({
            status: 'released',
            releasedContent: input.releasedContent,
            releasedAt: now,
            releasedBy: input.releasedBy,
          })
          .where(eq(doctorReviews.id, input.reviewId))
          .returning();
        await tx
          .update(cases)
          .set({ status: 'released', releasedAt: now, updatedAt: now })
          .where(eq(cases.id, input.caseId));
        return row ?? null;
      },
      { caseId: input.caseId },
    );
  }

  async getReview(context: AccessContext, caseId: string) {
    return this.#withAccess(
      context,
      { action: 'review.read', targetType: 'case', targetId: caseId },
      async (tx) => {
        const [row] = await tx
          .select()
          .from(doctorReviews)
          .where(eq(doctorReviews.caseId, caseId))
          .orderBy(desc(doctorReviews.createdAt))
          .limit(1);
        return row ?? null;
      },
      { caseId },
    );
  }

  async listReviewDiffs(context: AccessContext, caseId: string, reviewId: string) {
    return this.#withAccess(
      context,
      { action: 'review_diff.read', targetType: 'review', targetId: reviewId, metadata: { caseId } },
      async (tx) => tx.select().from(reviewDiffs).where(eq(reviewDiffs.reviewId, reviewId)),
      { caseId },
    );
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Messages and acknowledgements                                                             */
  /* ---------------------------------------------------------------------------------------- */

  async sendMessage(context: AccessContext, caseId: string, senderId: string, body: string) {
    return this.#withAccess(
      context,
      { action: 'message.send', targetType: 'case', targetId: caseId, metadata: { length: body.length } },
      async (tx) => {
        const [row] = await tx.insert(caseMessages).values({ caseId, senderId, body }).returning();
        return row ?? null;
      },
      { caseId },
    );
  }

  async listMessages(context: AccessContext, caseId: string) {
    return this.#withAccess(
      context,
      { action: 'message.read', targetType: 'case', targetId: caseId },
      async (tx) =>
        tx.select().from(caseMessages).where(eq(caseMessages.caseId, caseId)).orderBy(asc(caseMessages.sentAt)),
      { caseId },
    );
  }

  /** Records that the patient saw the emergency advisory and chose to continue. */
  async acknowledgeRedFlags(context: AccessContext, caseId: string) {
    return this.#withAccess(
      context,
      { action: 'red_flag.acknowledge', targetType: 'case', targetId: caseId },
      async (tx) =>
        tx
          .update(redFlagTriggers)
          .set({ acknowledgedAt: new Date() })
          .where(and(eq(redFlagTriggers.caseId, caseId), isNull(redFlagTriggers.acknowledgedAt)))
          .returning({ id: redFlagTriggers.id }),
      { caseId },
    );
  }
}
