import type { Condition } from './grammar.js';
import type { AnswerValue } from '../questionnaire/answers.js';

/**
 * Three-valued (Kleene) logic. An unanswered question yields `unknown` rather than `false`,
 * so that `not(equals(Q, 'yes'))` does NOT reveal a branch merely because Q has not been
 * reached yet. A branch opens only when we positively know its condition holds; a red flag
 * fires only when we positively know the pattern is present.
 */
export type Truth = 'true' | 'false' | 'unknown';

export interface EvaluationSubject {
  /** Age in whole years, or undefined when the date of birth is not yet known. */
  ageYears?: number | undefined;
}

export interface EvaluationContext {
  /** Only *active* answers belong here — answers retracted by a changed branch must be excluded. */
  answers: ReadonlyMap<string, AnswerValue>;
  subject: EvaluationSubject;
}

function numericOf(answer: AnswerValue): number | undefined {
  switch (answer.kind) {
    case 'numeric':
    case 'scale':
      return answer.value;
    case 'duration':
      return answer.days;
    default:
      return undefined;
  }
}

function selectedOptionIds(answer: AnswerValue): readonly string[] | undefined {
  switch (answer.kind) {
    case 'single_select':
      return [answer.optionId];
    case 'multi_select':
      return answer.optionIds;
    case 'body_map':
      return answer.regionIds;
    default:
      return undefined;
  }
}

function compareNumeric(
  answer: AnswerValue | undefined,
  predicate: (value: number) => boolean,
): Truth {
  if (answer === undefined) return 'unknown';
  const value = numericOf(answer);
  // A type mismatch is caught at publication time; at runtime we refuse to guess.
  if (value === undefined) return 'unknown';
  return predicate(value) ? 'true' : 'false';
}

function not(truth: Truth): Truth {
  if (truth === 'true') return 'false';
  if (truth === 'false') return 'true';
  return 'unknown';
}

function all(truths: readonly Truth[]): Truth {
  if (truths.includes('false')) return 'false';
  if (truths.includes('unknown')) return 'unknown';
  return 'true';
}

function any(truths: readonly Truth[]): Truth {
  if (truths.includes('true')) return 'true';
  if (truths.includes('unknown')) return 'unknown';
  return 'false';
}

export function evaluate(condition: Condition, context: EvaluationContext): Truth {
  switch (condition.op) {
    case 'all':
      return all(condition.of.map((c) => evaluate(c, context)));
    case 'any':
      return any(condition.of.map((c) => evaluate(c, context)));
    case 'not':
      return not(evaluate(condition.of, context));

    case 'answered':
      return context.answers.has(condition.questionId) ? 'true' : 'false';

    case 'equals': {
      const answer = context.answers.get(condition.questionId);
      if (answer === undefined) return 'unknown';
      const options = selectedOptionIds(answer);
      if (options === undefined) return 'unknown';
      return options.length === 1 && options[0] === condition.optionId ? 'true' : 'false';
    }

    case 'includes': {
      const answer = context.answers.get(condition.questionId);
      if (answer === undefined) return 'unknown';
      const options = selectedOptionIds(answer);
      if (options === undefined) return 'unknown';
      return options.includes(condition.optionId) ? 'true' : 'false';
    }

    case 'gt':
      return compareNumeric(context.answers.get(condition.questionId), (v) => v > condition.value);
    case 'lt':
      return compareNumeric(context.answers.get(condition.questionId), (v) => v < condition.value);
    case 'between':
      return compareNumeric(
        context.answers.get(condition.questionId),
        (v) => v >= condition.min && v <= condition.max,
      );
    case 'duration_gte':
      return compareNumeric(context.answers.get(condition.questionId), (v) => v >= condition.days);

    case 'age_gte': {
      const { ageYears } = context.subject;
      if (ageYears === undefined) return 'unknown';
      return ageYears >= condition.years ? 'true' : 'false';
    }
  }
}

/** A condition is *satisfied* only when positively known to hold. `unknown` never satisfies. */
export function isSatisfied(condition: Condition, context: EvaluationContext): boolean {
  return evaluate(condition, context) === 'true';
}
