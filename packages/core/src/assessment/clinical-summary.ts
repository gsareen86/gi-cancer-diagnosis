import type { AnswerValue, RecordedAnswer } from '../questionnaire/answers';
import { activeAnswerMap } from '../questionnaire/answers';
import type { Question, TemplateIndex } from '../questionnaire/template';
import type { SymptomCluster } from '../taxonomy';
import type { TriggeredRedFlag } from '../safety/red-flags';

/**
 * Compiles a case into the structured clinical summary the AI pipeline is grounded on and the
 * doctor reads.
 *
 * Deterministic by construction — no model is involved and no randomness enters. The same case
 * compiles to the same summary every time, which is what makes a past assessment reproducible.
 *
 * The distinction that matters most here is *explicitly denied* versus *never asked*. A model
 * left to infer absence from silence will invent reassurance; the fact table states which
 * symptoms the patient actively denied.
 */

export type FactPresence = 'present' | 'absent' | 'value' | 'indeterminate';

export interface ClinicalFact {
  questionId: string;
  cluster: SymptomCluster;
  /** The English question text, resolved through the caller's catalogue. */
  question: string;
  presence: FactPresence;
  /** Human-readable rendering of the answer, e.g. "black and tarry" or "6 episodes per day". */
  answer: string;
  /** Set when this question was only asked because of an earlier answer. */
  askedBecause?: string;
}

export interface DocumentExtractInput {
  documentId: string;
  /** Patient-supplied or extracted document type, e.g. "colonoscopy report". */
  reportType: string | null;
  reportDate: string | null;
  keyFindings: string[];
  abnormalValues: string[];
  machineReadable: boolean;
  /** True when a model produced this extract and no clinician has confirmed it. */
  aiGeneratedUnverified: boolean;
}

export interface ClinicalSummaryInput {
  caseId: string;
  index: TemplateIndex;
  /** Presentation order from the interview computation; drives narrative ordering. */
  orderedQuestionIds: readonly string[];
  answers: readonly RecordedAnswer[];
  revealedBy: ReadonlyMap<string, string | null>;
  redFlags: readonly TriggeredRedFlag[];
  documents: readonly DocumentExtractInput[];
  subject: { ageYears: number | null; sex: string | null };
  /** Resolves an i18n catalogue key to English text. Core never holds display strings itself. */
  resolve: (key: string) => string;
}

export interface ClinicalSummary {
  caseId: string;
  subject: { ageYears: number | null; sex: string | null };
  facts: ClinicalFact[];
  factsByCluster: Record<string, ClinicalFact[]>;
  presentFindings: string[];
  deniedFindings: string[];
  redFlags: Array<{ ruleId: string; urgency: string; basis: string }>;
  documents: DocumentExtractInput[];
  /** Prose rendering handed to the model alongside the fact table. */
  narrative: string;
}

function renderAnswer(
  question: Question,
  value: AnswerValue,
  resolve: (key: string) => string,
): { text: string; presence: FactPresence } {
  switch (value.kind) {
    case 'single_select': {
      const option = question.options.find((candidate) => candidate.id === value.optionId);
      if (!option) return { text: value.optionId, presence: 'indeterminate' };
      const presence: FactPresence =
        option.polarity === 'affirms' ? 'present'
        : option.polarity === 'denies' ? 'absent'
        : 'indeterminate';
      return { text: resolve(option.labelKey), presence };
    }
    case 'multi_select': {
      if (value.optionIds.length === 0) return { text: 'none selected', presence: 'absent' };
      const labels = value.optionIds.map((id) => {
        const option = question.options.find((candidate) => candidate.id === id);
        return option ? resolve(option.labelKey) : id;
      });
      return { text: labels.join('; '), presence: 'present' };
    }
    case 'scale': {
      const scale = question.scale;
      const range = scale ? ` (on a scale of ${scale.min}–${scale.max})` : '';
      return { text: `${value.value}${range}`, presence: 'value' };
    }
    case 'numeric':
      return { text: `${value.value} ${value.unit}`, presence: 'value' };
    case 'date':
      return { text: value.value, presence: 'value' };
    case 'duration':
      return { text: renderDuration(value.days), presence: 'value' };
    case 'text':
      return { text: value.value.trim() || 'no detail given', presence: 'value' };
    case 'body_map':
      return {
        text: value.regionIds.join('; '),
        presence: value.regionIds.length > 0 ? 'present' : 'absent',
      };
    case 'image':
      return {
        text: `${value.documentIds.length} image(s) attached`,
        presence: value.documentIds.length > 0 ? 'present' : 'absent',
      };
  }
}

function renderDuration(days: number): string {
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `about ${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  if (days < 730) {
    const months = Math.round(days / 30);
    return `about ${months} month${months === 1 ? '' : 's'}`;
  }
  const years = Math.round(days / 365);
  return `about ${years} year${years === 1 ? '' : 's'}`;
}

export function compileClinicalSummary(input: ClinicalSummaryInput): ClinicalSummary {
  const { index, resolve } = input;
  const answerMap = activeAnswerMap(input.answers);

  const facts: ClinicalFact[] = [];
  for (const questionId of input.orderedQuestionIds) {
    const question = index.questionById.get(questionId);
    const value = answerMap.get(questionId);
    if (!question || value === undefined) continue;

    const group = index.groupById.get(question.groupId);
    const { text, presence } = renderAnswer(question, value, resolve);
    const triggerId = input.revealedBy.get(questionId) ?? null;
    const trigger = triggerId ? index.questionById.get(triggerId) : undefined;

    const fact: ClinicalFact = {
      questionId,
      cluster: group?.cluster ?? 'history',
      question: resolve(question.promptKey),
      presence,
      answer: text,
    };
    if (trigger) fact.askedBecause = resolve(trigger.promptKey);
    facts.push(fact);
  }

  const factsByCluster: Record<string, ClinicalFact[]> = {};
  for (const fact of facts) {
    (factsByCluster[fact.cluster] ??= []).push(fact);
  }

  const presentFindings = facts
    .filter((fact) => fact.presence === 'present')
    .map((fact) => `${fact.question} — ${fact.answer}`);
  const deniedFindings = facts
    .filter((fact) => fact.presence === 'absent')
    .map((fact) => fact.question);

  const redFlags = input.redFlags.map((flag) => ({
    ruleId: flag.ruleId,
    urgency: flag.urgency,
    basis: resolve(flag.basisKey),
  }));

  return {
    caseId: input.caseId,
    subject: input.subject,
    facts,
    factsByCluster,
    presentFindings,
    deniedFindings,
    redFlags,
    documents: [...input.documents],
    narrative: renderNarrative({ facts, factsByCluster, redFlags, input }),
  };
}

function renderNarrative(args: {
  facts: ClinicalFact[];
  factsByCluster: Record<string, ClinicalFact[]>;
  redFlags: Array<{ ruleId: string; urgency: string; basis: string }>;
  input: ClinicalSummaryInput;
}): string {
  const { factsByCluster, redFlags, input } = args;
  const lines: string[] = [];

  const age = input.subject.ageYears === null ? 'age not recorded' : `${input.subject.ageYears}-year-old`;
  const sex = input.subject.sex ?? 'sex not recorded';
  lines.push(`Patient: ${age}, ${sex}.`);
  lines.push('');

  for (const [cluster, facts] of Object.entries(factsByCluster)) {
    lines.push(`## ${cluster.replace(/_/g, ' ')}`);
    for (const fact of facts) {
      const marker =
        fact.presence === 'absent' ? '[explicitly denied]'
        : fact.presence === 'present' ? '[reported]'
        : '';
      const because = fact.askedBecause ? ` (asked because: "${fact.askedBecause}")` : '';
      lines.push(`- ${fact.question} ${marker} → ${fact.answer}${because}`.replace(/\s+/g, ' '));
    }
    lines.push('');
  }

  if (redFlags.length > 0) {
    lines.push('## Deterministic red flags already triggered');
    lines.push(
      '(These were raised by clinician-authored rules before any model was involved. They are ' +
        'stated here for context only — they are not yours to raise, lower, or suppress.)',
    );
    for (const flag of redFlags) lines.push(`- [${flag.urgency}] ${flag.basis}`);
    lines.push('');
  }

  if (input.documents.length > 0) {
    lines.push('## Prior reports supplied by the patient');
    for (const document of input.documents) {
      const label = document.reportType ?? 'untyped document';
      const date = document.reportDate ? ` dated ${document.reportDate}` : '';
      const provenance = document.aiGeneratedUnverified
        ? ' [AI-extracted, unverified by a clinician]'
        : '';
      if (!document.machineReadable) {
        lines.push(`- ${label}${date}: not machine-readable; the doctor must read the original.`);
        continue;
      }
      lines.push(`- ${label}${date}${provenance}`);
      for (const finding of document.keyFindings) lines.push(`  - ${finding}`);
      for (const abnormal of document.abnormalValues) lines.push(`  - abnormal: ${abnormal}`);
    }
    lines.push('');
  }

  const unanswered = input.orderedQuestionIds.filter(
    (id) => !args.facts.some((fact) => fact.questionId === id),
  );
  if (unanswered.length > 0) {
    lines.push(
      `## Not answered\n${unanswered.length} question(s) on the patient's path were left unanswered. ` +
        'Treat these as unknown, not as absent.',
    );
  }

  return lines.join('\n').trim();
}
