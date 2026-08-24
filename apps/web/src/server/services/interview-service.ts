import {
  activeAnswerMap,
  computeInterview,
  createTextResolver,
  evaluateRedFlags,
  unansweredRequiredQuestionIds,
  validateAnswer,
  type AnswerValue,
  type Interview,
  type Question,
  type RecordedAnswer,
  type TriggeredRedFlag,
  type Urgency,
} from '@gi-compass/core';
import type { AccessContext, ClinicalRepository } from '@gi-compass/db';
import { clinical } from '../db';
import { currentRedFlagRules, loadTemplateVersion } from './content-service';

/**
 * The interview: what to ask next, whether the answer is acceptable, and whether the answers so
 * far describe an emergency.
 *
 * Red-flag evaluation happens here, synchronously, in the same request that persists the answer.
 * It is deterministic in-process work over an already-loaded answer set — no queue, no service
 * call, no model — because a patient who may be bleeding cannot wait on any of those.
 */

export interface RenderedOption {
  id: string;
  label: string;
  referenceImageIds: string[];
}

export interface RenderedQuestion {
  id: string;
  groupId: string;
  cluster: string;
  type: Question['type'];
  prompt: string;
  help: string | null;
  clinicalTerms: Array<{ term: string; explanation: string }>;
  options: RenderedOption[];
  numeric: Question['numeric'] | null;
  scale: (Question['scale'] & { minLabel: string; maxLabel: string }) | null;
  bodyMapRegionIds: string[];
  referenceImageIds: string[];
  required: boolean;
  multiSelectMax: number | null;
  textMaxLength: number;
}

export interface InterviewView {
  caseId: string;
  status: string;
  templateVersionId: string;
  entryPointId: string;
  locale: string;
  progress: Interview['progress'];
  complete: boolean;
  nextQuestion: RenderedQuestion | null;
  answeredQuestions: Array<{ question: RenderedQuestion; value: AnswerValue; askedBecause: string | null }>;
  unansweredRequired: string[];
  redFlags: RenderedRedFlag[];
  emergency: EmergencyAdvisory | null;
}

export interface RenderedRedFlag {
  ruleId: string;
  urgency: Urgency;
  basis: string;
}

export interface EmergencyAdvisory {
  /** Symptom-based, never condition-based. */
  messages: string[];
  contacts: Array<{ labelKey: string; number: string }>;
}

export const EMERGENCY_NUMBERS = [
  { labelKey: 'emergency.number.general', number: '112' },
  { labelKey: 'emergency.number.ambulance', number: '108' },
] as const;

function renderQuestion(
  question: Question,
  cluster: string,
  resolve: (key: string) => string,
): RenderedQuestion {
  return {
    id: question.id,
    groupId: question.groupId,
    cluster,
    type: question.type,
    prompt: resolve(question.promptKey),
    help: question.helpKey === undefined ? null : resolve(question.helpKey),
    clinicalTerms: question.clinicalTerms.map((term) => ({
      term: term.term,
      explanation: resolve(term.layExplanationKey),
    })),
    options: question.options
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((option) => ({
        id: option.id,
        label: resolve(option.labelKey),
        referenceImageIds: option.referenceImageIds,
      })),
    numeric: question.numeric ?? null,
    scale:
      question.scale === undefined
        ? null
        : {
            ...question.scale,
            minLabel: resolve(question.scale.minLabelKey),
            maxLabel: resolve(question.scale.maxLabelKey),
          },
    bodyMapRegionIds: question.bodyMapRegionIds,
    referenceImageIds: question.referenceImageIds,
    required: question.required,
    multiSelectMax: question.multiSelectMax ?? null,
    textMaxLength: question.textMaxLength,
  };
}

export interface CaseRecord {
  id: string;
  status: string;
  templateVersionId: string;
  entryPointId: string;
  patientId: string;
}

export interface BuildViewInput {
  context: AccessContext;
  caseRecord: CaseRecord;
  locale: string;
  ageYears: number | null;
  repo?: ClinicalRepository;
}

export async function buildInterviewView(input: BuildViewInput): Promise<InterviewView> {
  const repo = input.repo ?? clinical();
  const { document, index } = await loadTemplateVersion(input.caseRecord.templateVersionId);
  const resolve = createTextResolver(document, input.locale);
  const answers = await repo.listResponses(input.context, input.caseRecord.id);
  const subject = input.ageYears === null ? {} : { ageYears: input.ageYears };

  const interview = computeInterview({
    index,
    entryPointId: input.caseRecord.entryPointId,
    answers,
    subject,
  });

  const answerMap = activeAnswerMap(answers);
  const clusterOf = (question: Question): string =>
    index.groupById.get(question.groupId)?.cluster ?? 'history';

  const answeredQuestions = interview.activeQuestions
    .filter((entry) => entry.answered)
    .map((entry) => {
      const trigger = entry.revealedByQuestionId
        ? index.questionById.get(entry.revealedByQuestionId)
        : undefined;
      return {
        question: renderQuestion(entry.question, clusterOf(entry.question), resolve),
        value: answerMap.get(entry.question.id) as AnswerValue,
        askedBecause: trigger ? resolve(trigger.promptKey) : null,
      };
    });

  const nextQuestionEntry = interview.activeQuestions.find(
    (entry) => entry.question.id === interview.nextQuestionId,
  );

  const storedFlags = await repo.listRedFlags(input.context, input.caseRecord.id);
  const redFlagText = (await currentRedFlagRules()).clinicalText;
  const resolveFlag = createTextResolver({ clinicalText: redFlagText }, input.locale);
  const rendered: RenderedRedFlag[] = storedFlags.map((flag) => ({
    ruleId: flag.ruleId,
    urgency: flag.urgency,
    basis: resolveFlag(flag.basisKey),
  }));

  const emergencies = rendered.filter((flag) => flag.urgency === 'emergency');

  return {
    caseId: input.caseRecord.id,
    status: input.caseRecord.status,
    templateVersionId: input.caseRecord.templateVersionId,
    entryPointId: input.caseRecord.entryPointId,
    locale: input.locale,
    progress: interview.progress,
    complete: interview.complete,
    nextQuestion: nextQuestionEntry
      ? renderQuestion(nextQuestionEntry.question, clusterOf(nextQuestionEntry.question), resolve)
      : null,
    answeredQuestions,
    unansweredRequired: unansweredRequiredQuestionIds(interview),
    redFlags: rendered,
    emergency:
      emergencies.length === 0
        ? null
        : { messages: emergencies.map((flag) => flag.basis), contacts: [...EMERGENCY_NUMBERS] },
  };
}

export type SubmitAnswerResult =
  | { status: 'rejected'; rejection: ReturnType<typeof validateAnswer> }
  | { status: 'saved'; view: InterviewView; newlyTriggered: TriggeredRedFlag[] };

/**
 * Validates, persists, evaluates red flags, and returns the next question — all in one request.
 *
 * The order matters: nothing is persisted unless the answer satisfies its question's contract,
 * and the red-flag evaluation runs over the answer set *including* this answer, inside the same
 * transaction as the write, so the escalation cannot be lost to a later failure.
 */
export async function submitAnswer(input: {
  context: AccessContext;
  caseRecord: CaseRecord;
  questionId: string;
  rawValue: unknown;
  locale: string;
  ageYears: number | null;
}): Promise<SubmitAnswerResult> {
  const repo = clinical();
  const { index } = await loadTemplateVersion(input.caseRecord.templateVersionId);
  const question = index.questionById.get(input.questionId);
  if (!question) {
    return {
      status: 'rejected',
      rejection: {
        ok: false,
        rejection: {
          code: 'malformed',
          message: 'This question is not part of the version this case was started on',
        },
      },
    };
  }

  const validation = validateAnswer(question, input.rawValue);
  if (!validation.ok) return { status: 'rejected', rejection: validation };

  const existing = await repo.listResponses(input.context, input.caseRecord.id);
  const projected: RecordedAnswer[] = [
    ...existing.filter((answer) => answer.questionId !== input.questionId),
    { questionId: input.questionId, value: validation.value, answeredAt: new Date(), active: true },
  ];

  const subject = input.ageYears === null ? {} : { ageYears: input.ageYears };
  const interview = computeInterview({
    index,
    entryPointId: input.caseRecord.entryPointId,
    answers: projected,
    subject,
  });

  const rules = await currentRedFlagRules();
  const evaluation = evaluateRedFlags({
    ruleSet: rules.ruleSet,
    // Only answers still on the patient's path count: an answer stranded by a changed branch
    // must not keep a red flag alive.
    answers: interview.effectiveAnswers,
    subject,
  });

  const previouslyTriggered = new Set(
    (await repo.listRedFlags(input.context, input.caseRecord.id)).map((flag) => flag.ruleId),
  );

  await repo.saveAnswer(input.context, {
    caseId: input.caseRecord.id,
    questionId: input.questionId,
    value: validation.value,
    retractedQuestionIds: interview.retractedQuestionIds,
    redFlags: evaluation.triggered,
    ruleSetId: rules.ruleSetId,
  });

  const view = await buildInterviewView({
    context: input.context,
    caseRecord: input.caseRecord,
    locale: input.locale,
    ageYears: input.ageYears,
  });

  return {
    status: 'saved',
    view,
    newlyTriggered: evaluation.triggered.filter((flag) => !previouslyTriggered.has(flag.ruleId)),
  };
}

export { activeAnswerMap };
