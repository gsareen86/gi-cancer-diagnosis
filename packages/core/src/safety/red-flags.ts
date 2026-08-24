import { z } from 'zod';
import { conditionSchema, type Condition } from '../conditions/grammar.js';
import { isSatisfied, type EvaluationContext, type EvaluationSubject } from '../conditions/evaluate.js';
import { referencedQuestionIds } from '../conditions/introspect.js';
import type { AnswerValue } from '../questionnaire/answers.js';
import { CONDITION_NAMING_TERMS } from '../taxonomy.js';

/**
 * Deterministic emergency triage.
 *
 * This module must remain synchronous, in-process, and dependency-free. It never imports an
 * HTTP client, an AI client, or anything asynchronous — a patient who may be actively
 * bleeding cannot wait on a model call, and `red-flags.no-ai-dependency.test.ts` asserts
 * that this stays true.
 */

export const urgencySchema = z.enum(['emergency', 'urgent', 'routine-but-flagged']);
export type Urgency = z.infer<typeof urgencySchema>;

const URGENCY_RANK: Record<Urgency, number> = {
  emergency: 3,
  urgent: 2,
  'routine-but-flagged': 1,
};

export const redFlagRuleSchema = z.object({
  id: z.string().min(1),
  /** Clinician-authored, patient-safe explanation of the pattern. Symptom-based, never a condition. */
  basisKey: z.string().min(1),
  urgency: urgencySchema,
  when: conditionSchema,
});
export type RedFlagRule = z.infer<typeof redFlagRuleSchema>;

export const redFlagRuleSetSchema = z.object({
  version: z.number().int().positive(),
  rules: z.array(redFlagRuleSchema),
});
export type RedFlagRuleSet = z.infer<typeof redFlagRuleSetSchema>;

export interface TriggeredRedFlag {
  ruleId: string;
  ruleSetVersion: number;
  urgency: Urgency;
  basisKey: string;
  /** The answered questions that satisfied the rule — the recorded basis for the decision. */
  contributingQuestionIds: string[];
}

export interface RedFlagEvaluation {
  triggered: TriggeredRedFlag[];
  highestUrgency: Urgency | null;
  /** True when the patient-facing full-screen escalation must be shown immediately. */
  requiresEmergencyEscalation: boolean;
}

export interface RedFlagInput {
  ruleSet: RedFlagRuleSet;
  answers: ReadonlyMap<string, AnswerValue>;
  subject: EvaluationSubject;
}

export function evaluateRedFlags(input: RedFlagInput): RedFlagEvaluation {
  const context: EvaluationContext = { answers: input.answers, subject: input.subject };
  const triggered: TriggeredRedFlag[] = [];

  for (const rule of input.ruleSet.rules) {
    if (!isSatisfied(rule.when, context)) continue;
    triggered.push({
      ruleId: rule.id,
      ruleSetVersion: input.ruleSet.version,
      urgency: rule.urgency,
      basisKey: rule.basisKey,
      contributingQuestionIds: referencedQuestionIds(rule.when).filter((id) =>
        input.answers.has(id),
      ),
    });
  }

  triggered.sort(
    (a, b) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] || a.ruleId.localeCompare(b.ruleId),
  );

  const highest = triggered[0]?.urgency ?? null;
  return {
    triggered,
    highestUrgency: highest,
    requiresEmergencyEscalation: highest === 'emergency',
  };
}

/** India's emergency numbers, shown verbatim in the escalation (spec: safety/red-flag-triage). */
export const EMERGENCY_CONTACTS = [
  { labelKey: 'emergency.number.general', number: '112' },
  { labelKey: 'emergency.number.ambulance', number: '108' },
] as const;

export interface CopyProblem {
  code: 'names_a_condition';
  message: string;
  term: string;
}

/**
 * Escalation copy must describe the *pattern of answers* and the need for urgent in-person
 * care — never a condition. Publication is refused when it names one.
 */
export function validateEscalationCopy(
  text: string,
  bannedTerms: readonly string[] = CONDITION_NAMING_TERMS,
): CopyProblem[] {
  const haystack = text.toLowerCase();
  const problems: CopyProblem[] = [];
  const seen = new Set<string>();
  for (const term of bannedTerms) {
    const needle = term.toLowerCase();
    if (seen.has(needle) || !haystack.includes(needle)) continue;
    seen.add(needle);
    problems.push({
      code: 'names_a_condition',
      message: `Escalation copy names a condition ("${term}"). Describe the pattern of answers and the need for urgent in-person care instead.`,
      term,
    });
  }
  return problems;
}

export function highestUrgencyOf(flags: readonly TriggeredRedFlag[]): Urgency | null {
  return flags.reduce<Urgency | null>(
    (highest, flag) =>
      highest === null || URGENCY_RANK[flag.urgency] > URGENCY_RANK[highest] ? flag.urgency : highest,
    null,
  );
}

export function compareUrgency(a: Urgency, b: Urgency): number {
  return URGENCY_RANK[b] - URGENCY_RANK[a];
}

export type { Condition };
