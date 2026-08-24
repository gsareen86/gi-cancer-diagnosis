import { desc, eq } from 'drizzle-orm';
import {
  activeAnswerMap,
  compileClinicalSummary,
  computeInterview,
  createTextResolver,
  evaluateRedFlags,
  validateAssessment,
  MANDATORY_DISCLAIMER,
  assessmentToolJsonSchema,
  type AssessmentRejection,
  type ClinicalSummary,
  type DocumentExtractInput,
  type TaxonomyEntry,
} from '@gi-compass/core';
import { hasConsentFor, systemContext, tables } from '@gi-compass/db';
import { clinical, database } from '../db';
import { env } from '../env';
import { ageInYears } from './age';
import { currentRedFlagRules, loadTemplateVersion } from './content-service';

/**
 * The AI assessment pipeline.
 *
 * Everything that makes this safe happens on this side of the network call: the consent check
 * before any clinical content leaves the platform, the deterministic summary compilation, and
 * the schema validation of whatever comes back. The AI service is treated as untrusted — a
 * response that does not conform is a failure to retry, never something to repair.
 */

export const PROMPT_VERSION = 'assessment-v1';
export const MAX_ASSESSMENT_ATTEMPTS = 3;

export interface AssessmentRequestPayload {
  caseId: string;
  promptVersion: string;
  clinicalSummary: ClinicalSummary;
  /** The exact shape the model must produce, generated from the same schema that validates it. */
  outputSchema: Record<string, unknown>;
  taxonomy: Array<{ id: string; label: string; urgentReferralOnly: boolean }>;
  /** Set on a retry: what was wrong last time, so the reminder can be specific. */
  previousRejections?: AssessmentRejection[];
}

export interface AssessmentServiceResponse {
  assessment: unknown;
  modelVersion: string;
  kbVersion: string;
  retrievedChunkIds: string[];
  grounded: boolean;
}

export interface AiTransport {
  generate(payload: AssessmentRequestPayload): Promise<AssessmentServiceResponse>;
}

/** HTTP client for `services/ai`. The model provider key lives there and never here. */
export const httpTransport: AiTransport = {
  async generate(payload) {
    const baseUrl = env().AI_SERVICE_URL;
    if (baseUrl === undefined) throw new Error('AI_SERVICE_URL is not configured');

    const response = await fetch(`${baseUrl}/assess`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env().AI_SERVICE_TOKEN === undefined
          ? {}
          : { authorization: `Bearer ${env().AI_SERVICE_TOKEN}` }),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      throw new Error(`AI service responded ${response.status}`);
    }
    return (await response.json()) as AssessmentServiceResponse;
  },
};

let transport: AiTransport = httpTransport;

export function setAiTransport(next: AiTransport): void {
  transport = next;
}

export type AssessmentOutcome =
  | { status: 'generated'; assessmentId: string; grounded: boolean }
  | { status: 'skipped'; reason: string }
  | { status: 'unavailable'; reason: string; rejections?: AssessmentRejection[] };

/**
 * Compiles, retrieves, calls, validates, and stores.
 *
 * Runs after submission, off the patient's request path. Whatever happens here, the case is
 * already in the doctor's queue — the assessment is an addition to that review, never a
 * precondition for it.
 */
export async function requestAssessment(caseId: string): Promise<AssessmentOutcome> {
  const db = database();
  const repo = clinical();

  const meta = await loadCaseMetadata(caseId);
  if (meta === null) return { status: 'unavailable', reason: 'case_not_found' };

  // The consent check happens immediately before any clinical content could leave the platform.
  // A patient who withdrew between submitting and this job running sends nothing.
  if (!(await hasConsentFor(db, meta.patientId, 'ai_assisted_analysis'))) {
    const context = systemContext(meta.patientId, 'account_processing');
    await repo.transitionCase(context, caseId, 'ai_skipped', {
      aiSkipReason: 'Consent for AI-assisted analysis was withdrawn before processing began.',
    });
    return { status: 'skipped', reason: 'consent_withdrawn' };
  }

  const context = systemContext(meta.patientId, 'ai_assisted_analysis');
  await repo.transitionCase(context, caseId, 'ai_processing');

  const summary = await compileSummaryForCase(caseId, meta);
  const taxonomy = await loadTaxonomy();

  let rejections: AssessmentRejection[] | undefined;

  for (let attempt = 1; attempt <= MAX_ASSESSMENT_ATTEMPTS; attempt += 1) {
    try {
      const payload: AssessmentRequestPayload = {
        caseId,
        promptVersion: PROMPT_VERSION,
        clinicalSummary: summary,
        outputSchema: assessmentToolJsonSchema(taxonomy),
        taxonomy: taxonomy.map((entry) => ({
          id: entry.id,
          label: entry.label,
          urgentReferralOnly: entry.urgentReferralOnly,
        })),
        ...(rejections === undefined ? {} : { previousRejections: rejections }),
      };

      const response = await transport.generate(payload);
      const validation = validateAssessment(response.assessment, { taxonomy });

      if (!validation.ok) {
        // Not repaired, not partially saved. The next attempt carries the specific violations.
        rejections = validation.rejections;
        console.warn('[assessment] schema violation', {
          caseId,
          attempt,
          codes: validation.rejections.map((rejection) => rejection.code),
        });
        continue;
      }

      const stored = await repo.recordAssessment(context, {
        caseId,
        outcome: response.grounded ? 'generated' : 'ungrounded',
        modelVersion: response.modelVersion,
        promptVersion: PROMPT_VERSION,
        kbVersion: response.kbVersion,
        retrievedChunkIds: response.retrievedChunkIds,
        payload: { ...validation.assessment, disclaimer: MANDATORY_DISCLAIMER },
      });

      await repo.transitionCase(context, caseId, 'ai_processed');
      return {
        status: 'generated',
        assessmentId: stored?.id ?? '',
        grounded: response.grounded,
      };
    } catch (error) {
      console.error('[assessment] attempt failed', { caseId, attempt, error });
      if (attempt === MAX_ASSESSMENT_ATTEMPTS) {
        return recordUnavailable(caseId, context, 'provider_error', rejections);
      }
    }
  }

  return recordUnavailable(caseId, context, 'schema_violations_exhausted', rejections);
}

/**
 * Retry budget spent. The case goes to the doctor marked "AI assessment unavailable" and is
 * reviewed from the raw answers — which is a worse review, not an absent one.
 */
async function recordUnavailable(
  caseId: string,
  context: ReturnType<typeof systemContext>,
  reason: string,
  rejections: AssessmentRejection[] | undefined,
): Promise<AssessmentOutcome> {
  const repo = clinical();
  await repo.recordAssessment(context, {
    caseId,
    outcome: 'unavailable',
    modelVersion: 'unavailable',
    promptVersion: PROMPT_VERSION,
    kbVersion: 'unavailable',
    retrievedChunkIds: [],
    payload: null,
    failureReason: reason,
  });
  await repo.transitionCase(context, caseId, 'ai_processed');
  return rejections === undefined
    ? { status: 'unavailable', reason }
    : { status: 'unavailable', reason, rejections };
}

interface CaseMetadata {
  caseId: string;
  patientId: string;
  templateVersionId: string;
  entryPointId: string;
  locale: string;
  ageYears: number | null;
  sex: string | null;
}

async function loadCaseMetadata(caseId: string): Promise<CaseMetadata | null> {
  const found = await clinical().resolveCaseForSystem(caseId);
  if (found === null) return null;

  const [patient] = await database()
    .select({
      locale: tables.users.locale,
      dateOfBirth: tables.users.dateOfBirth,
      sex: tables.users.sex,
    })
    .from(tables.users)
    .where(eq(tables.users.id, found.patientId))
    .limit(1);

  return {
    caseId,
    patientId: found.patientId,
    templateVersionId: found.templateVersionId,
    entryPointId: found.entryPointId,
    locale: patient?.locale ?? 'en',
    ageYears: ageInYears(patient?.dateOfBirth ?? null),
    sex: patient?.sex ?? null,
  };
}

async function compileSummaryForCase(caseId: string, meta: CaseMetadata): Promise<ClinicalSummary> {
  const repo = clinical();
  const context = systemContext(meta.patientId, 'ai_assisted_analysis');
  const { document, index } = await loadTemplateVersion(meta.templateVersionId);
  const resolve = createTextResolver(document, 'en');

  const answers = await repo.listResponses(context, caseId);
  const subject = meta.ageYears === null ? {} : { ageYears: meta.ageYears };
  const interview = computeInterview({
    index,
    entryPointId: meta.entryPointId,
    answers,
    subject,
  });

  const rules = await currentRedFlagRules();
  const flags = evaluateRedFlags({
    ruleSet: rules.ruleSet,
    answers: activeAnswerMap(answers.filter((answer) => interview.activeQuestionIds.includes(answer.questionId))),
    subject,
  });
  const flagResolver = createTextResolver({ clinicalText: rules.clinicalText }, 'en');

  const documents = await repo.listDocuments(context, caseId);
  const extracts: DocumentExtractInput[] = documents.map((document_) => {
    const extract = (document_.extract ?? {}) as Record<string, unknown>;
    return {
      documentId: document_.id,
      reportType: (extract.reportType as string | undefined) ?? document_.patientTypeTag,
      reportDate:
        (extract.reportDate as string | undefined) ??
        (document_.patientDateTag === null ? null : String(document_.patientDateTag)),
      keyFindings: Array.isArray(extract.keyFindings) ? (extract.keyFindings as string[]) : [],
      abnormalValues: Array.isArray(extract.abnormalValues) ? (extract.abnormalValues as string[]) : [],
      machineReadable: document_.machineReadable ?? false,
      aiGeneratedUnverified: document_.extractVerifiedAt === null,
    };
  });

  return compileClinicalSummary({
    caseId,
    index,
    orderedQuestionIds: interview.activeQuestionIds,
    answers,
    revealedBy: new Map(
      interview.activeQuestions.map((entry) => [entry.question.id, entry.revealedByQuestionId]),
    ),
    redFlags: flags.triggered.map((flag) => ({ ...flag, basisKey: flag.basisKey })),
    documents: extracts,
    subject: { ageYears: meta.ageYears, sex: meta.sex },
    resolve: (key) => {
      const clinicalText = resolve(key);
      return clinicalText === key ? flagResolver(key) : clinicalText;
    },
  });
}

async function loadTaxonomy(): Promise<TaxonomyEntry[]> {
  const rows = await database()
    .select()
    .from(tables.diseaseTaxonomyEntries)
    .where(eq(tables.diseaseTaxonomyEntries.active, true))
    .orderBy(desc(tables.diseaseTaxonomyEntries.urgentReferralOnly));

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    clusters: row.clusters as TaxonomyEntry['clusters'],
    urgentReferralOnly: row.urgentReferralOnly,
    active: row.active,
  }));
}
