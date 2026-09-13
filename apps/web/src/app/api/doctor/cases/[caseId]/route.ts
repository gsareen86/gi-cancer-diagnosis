import { createTextResolver, compileClinicalSummary } from '@gi-compass/core';
import { clinical, database } from '@/server/db';
import { tables } from '@gi-compass/db';
import { eq } from 'drizzle-orm';
import { decryptOptional } from '@/server/crypto';
import { listDeliveriesForCase } from '@/server/services/notification-service';
import { buildInterviewView } from '@/server/services/interview-service';
import { loadTemplateVersion, currentRedFlagRules } from '@/server/services/content-service';
import { ageInYears } from '@/server/services/age';
import { caseReference, patientReference } from '@/lib/references';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * Everything the reviewing doctor needs, on one screen: the patient's answers grouped by
 * symptom cluster with the branching context that produced them, the uploaded documents, the
 * red flags with their basis, and the AI assessment.
 *
 * Assembled in one response rather than several so the doctor is not tab-hunting between
 * panels that have to be read together. Each panel's read is separately audited by the
 * repository.
 */
export const GET = route<{ caseId: string }>({ roles: ['doctor'] }, async ({ params, session, metadata }) => {
  const repo = clinical();
  const resolved = await repo.resolveCaseForSystem(params.caseId);
  if (resolved === null) return problem('not_found', 'error.not_found');

  const context = accessContext(session, resolved.patientId, 'share_with_assigned_doctor', metadata);
  const caseRecord = await repo.getCase(context, params.caseId);
  if (!caseRecord) return problem('not_found', 'error.not_found');

  const [patient] = await database()
    .select({
      dateOfBirth: tables.users.dateOfBirth,
      publicNumber: tables.users.publicNumber,
      sex: tables.users.sex,
      locale: tables.users.locale,
      fullNameEnc: tables.users.fullNameEnc,
    })
    .from(tables.users)
    .where(eq(tables.users.id, resolved.patientId))
    .limit(1);

  // The doctor reads in their own language; the answers are stored as identifiers, so this
  // changes only how they render.
  const doctorLocale = 'en';
  const { document, index } = await loadTemplateVersion(caseRecord.templateVersionId);
  const resolveText = createTextResolver(document, doctorLocale);

  const view = await buildInterviewView({
    context,
    caseRecord: {
      id: caseRecord.id,
      status: caseRecord.status,
      templateVersionId: caseRecord.templateVersionId,
      entryPointId: caseRecord.entryPointId,
      patientId: caseRecord.patientId,
    },
    locale: doctorLocale,
    ageYears: ageInYears(patient?.dateOfBirth ?? null),
  });

  const documents = await repo.listDocuments(context, params.caseId);
  const history = await repo.getClinicalHistory(context, params.caseId);
  // Non-clinical by construction — a type, a time and a delivery outcome — so it does not go
  // through the clinical funnel. The case-level authorization above already applies.
  const deliveries = await listDeliveriesForCase(params.caseId);
  const assessment = await repo.getLatestAssessment(context, params.caseId);
  const review = await repo.getReview(context, params.caseId);
  const rules = await currentRedFlagRules();
  const flagText = createTextResolver({ clinicalText: rules.clinicalText }, doctorLocale);
  const storedFlags = await repo.listRedFlags(context, params.caseId);
  const sourceAnswers = await repo.listResponses(context, params.caseId);
  const brief = compileClinicalSummary({
    caseId: params.caseId, index, history,
    orderedQuestionIds: view.answeredQuestions.map(entry => entry.question.id),
    answers: sourceAnswers, revealedBy: new Map(), redFlags: [],
    documents: documents.filter(doc => doc.scanStatus === 'clean').map(doc => ({ documentId: doc.id, reportType: doc.patientTypeTag, reportDate: doc.patientDateTag, keyFindings: [], abnormalValues: [], machineReadable: doc.machineReadable ?? false, aiGeneratedUnverified: doc.extractVerifiedAt === null })),
    subject: { ageYears: ageInYears(patient?.dateOfBirth ?? null), sex: patient?.sex ?? null }, resolve: resolveText,
  });

  // Grouped by symptom cluster, which is how the interview was organized and how a clinician
  // reads a history.
  const byCluster = new Map<string, typeof view.answeredQuestions>();
  for (const entry of view.answeredQuestions) {
    const cluster = entry.question.cluster;
    byCluster.set(cluster, [...(byCluster.get(cluster) ?? []), entry]);
  }

  return ok({
    brief,
    case: {
      id: caseRecord.id,
      reference: caseReference(caseRecord.publicNumber),
      status: caseRecord.status,
      entryPoint: resolveText(index.entryPointById.get(caseRecord.entryPointId)?.labelKey ?? ''),
      createdAt: caseRecord.createdAt,
      submittedAt: caseRecord.submittedAt,
      aiSkipReason: caseRecord.aiSkipReason,
    },
    patient: {
      /*
       * The name reaches this response only because the caller is the *assigned* doctor: this
       * route is scoped to `roles: ['doctor']` and the read above passed the
       * `share_with_assigned_doctor` consent gate, which is what makes any of this case visible.
       * A doctor browsing the claimable queue never gets here, and the queue endpoint sends no
       * name at all — see `triage-service.ts`.
       *
       * Decryption happens here and nowhere downstream; `fullNameEnc` never leaves the server.
       */
      fullName: decryptOptional(patient?.fullNameEnc ?? null),
      reference: patient ? patientReference(patient.publicNumber) : null,
      ageYears: ageInYears(patient?.dateOfBirth ?? null),
      sex: patient?.sex ?? null,
      locale: patient?.locale ?? 'en',
    },
    /*
     * Null when the patient never completed the history step, which the interface renders as
     * "not recorded". An empty object would render as a patient who reported nothing, and those
     * are different clinical facts.
     */
    history:
      history === null
        ? null
        : {
            heightCm: history.heightCm,
            weightKg: history.weightKg,
            conditions: history.conditions,
            surgeries: history.surgeries,
            medications: history.medications,
            allergies: history.allergies,
            familyHistory: history.familyHistory,
            lifestyle: history.lifestyle,
            additionalNotes: history.additionalNotes,
            lastMenstrualPeriod: history.lastMenstrualPeriod,
            completedAt: history.completedAt,
          },
    deliveries,
    answersByCluster: [...byCluster.entries()].map(([cluster, entries]) => ({
      cluster,
      answers: entries.map((entry) => ({
        questionId: entry.question.id,
        prompt: entry.question.prompt,
        value: entry.value,
        // Shown with the answer, so the doctor can see why the question was asked at all.
        askedBecause: entry.askedBecause,
        options: entry.question.options,
        type: entry.question.type,
      })),
    })),
    documents: documents.map((doc) => ({
      id: doc.id,
      originalFilename: doc.originalFilename,
      contentType: doc.contentType,
      scanStatus: doc.scanStatus,
      patientTypeTag: doc.patientTypeTag,
      patientDateTag: doc.patientDateTag,
      machineReadable: doc.machineReadable,
      extract: doc.extract,
      // Always labelled: an extract nobody has checked is a hypothesis, not a finding.
      extractVerified: doc.extractVerifiedAt !== null,
    })),
    redFlags: storedFlags.map((flag) => ({
      ruleId: flag.ruleId,
      urgency: flag.urgency,
      basis: flagText(flag.basisKey),
      contributingQuestionIds: flag.contributingQuestionIds,
      acknowledgedByPatient: flag.acknowledgedAt !== null,
    })),
    assessment:
      assessment === null
        ? null
        : {
            id: assessment.id,
            outcome: assessment.outcome,
            modelVersion: assessment.modelVersion,
            promptVersion: assessment.promptVersion,
            kbVersion: assessment.kbVersion,
            groundingChunkCount: assessment.retrievedChunkIds.length,
            generatedAt: assessment.generatedAt,
            failureReason: assessment.failureReason,
            payload: assessment.payload,
          },
    review:
      review === null
        ? null
        : {
            id: review.id,
            status: review.status,
            finalSummary: review.finalSummary,
            doctorNotes: review.doctorNotes,
            draftRevision: review.draftRevision,
            releasedAt: review.releasedAt,
          },
  });
});
