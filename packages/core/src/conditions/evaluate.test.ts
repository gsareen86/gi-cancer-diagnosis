import { describe, expect, it } from 'vitest';
import { evaluate, isSatisfied, type EvaluationContext, type Truth } from './evaluate.js';
import { checkConditionStructure, conditionSchema, parseCondition, type Condition } from './grammar.js';
import type { AnswerValue } from '../questionnaire/answers.js';

const ctx = (
  answers: Record<string, AnswerValue>,
  ageYears?: number,
): EvaluationContext => ({
  answers: new Map(Object.entries(answers)),
  subject: ageYears === undefined ? {} : { ageYears },
});

const single = (optionId: string): AnswerValue => ({ kind: 'single_select', optionId });
const multi = (...optionIds: string[]): AnswerValue => ({ kind: 'multi_select', optionIds });
const numeric = (value: number): AnswerValue => ({ kind: 'numeric', value, unit: 'x' });
const duration = (days: number): AnswerValue => ({ kind: 'duration', days });

describe('leaf predicates', () => {
  const cases: Array<[string, Condition, EvaluationContext, Truth]> = [
    ['answered is true when present', { op: 'answered', questionId: 'q' }, ctx({ q: single('a') }), 'true'],
    ['answered is false when absent — never unknown', { op: 'answered', questionId: 'q' }, ctx({}), 'false'],

    ['equals matches', { op: 'equals', questionId: 'q', optionId: 'a' }, ctx({ q: single('a') }), 'true'],
    ['equals mismatches', { op: 'equals', questionId: 'q', optionId: 'b' }, ctx({ q: single('a') }), 'false'],
    ['equals on an unanswered question is unknown', { op: 'equals', questionId: 'q', optionId: 'a' }, ctx({}), 'unknown'],
    ['equals is false for a multi-select with more than one selection',
      { op: 'equals', questionId: 'q', optionId: 'a' }, ctx({ q: multi('a', 'b') }), 'false'],

    ['includes finds a member', { op: 'includes', questionId: 'q', optionId: 'b' }, ctx({ q: multi('a', 'b') }), 'true'],
    ['includes misses', { op: 'includes', questionId: 'q', optionId: 'c' }, ctx({ q: multi('a', 'b') }), 'false'],
    ['includes on a body map', { op: 'includes', questionId: 'q', optionId: 'ruq' },
      ctx({ q: { kind: 'body_map', regionIds: ['ruq'] } }), 'true'],

    ['gt', { op: 'gt', questionId: 'q', value: 3 }, ctx({ q: numeric(4) }), 'true'],
    ['gt is strict', { op: 'gt', questionId: 'q', value: 3 }, ctx({ q: numeric(3) }), 'false'],
    ['lt', { op: 'lt', questionId: 'q', value: 3 }, ctx({ q: numeric(2) }), 'true'],
    ['between is inclusive at both ends', { op: 'between', questionId: 'q', min: 2, max: 4 }, ctx({ q: numeric(4) }), 'true'],
    ['between excludes outside', { op: 'between', questionId: 'q', min: 2, max: 4 }, ctx({ q: numeric(5) }), 'false'],
    ['duration_gte', { op: 'duration_gte', questionId: 'q', days: 14 }, ctx({ q: duration(14) }), 'true'],
    ['duration_gte below threshold', { op: 'duration_gte', questionId: 'q', days: 14 }, ctx({ q: duration(13) }), 'false'],

    ['age_gte', { op: 'age_gte', years: 45 }, ctx({}, 46), 'true'],
    ['age_gte below', { op: 'age_gte', years: 45 }, ctx({}, 44), 'false'],
    ['age_gte with no recorded age is unknown', { op: 'age_gte', years: 45 }, ctx({}), 'unknown'],

    ['a numeric predicate on a non-numeric answer is unknown, never a guess',
      { op: 'gt', questionId: 'q', value: 3 }, ctx({ q: single('a') }), 'unknown'],
    ['an option predicate on a numeric answer is unknown',
      { op: 'equals', questionId: 'q', optionId: 'a' }, ctx({ q: numeric(1) }), 'unknown'],
  ];

  it.each(cases)('%s', (_name, condition, context, expected) => {
    expect(evaluate(condition, context)).toBe(expected);
  });
});

describe('Kleene combinators', () => {
  const known: Condition = { op: 'answered', questionId: 'known' };
  const unknownLeaf: Condition = { op: 'equals', questionId: 'missing', optionId: 'a' };
  const falseLeaf: Condition = { op: 'answered', questionId: 'missing' };
  const context = ctx({ known: single('a') });

  it('all is false as soon as one operand is false, even beside an unknown', () => {
    expect(evaluate({ op: 'all', of: [falseLeaf, unknownLeaf] }, context)).toBe('false');
  });

  it('all is unknown when nothing is false but something is unknown', () => {
    expect(evaluate({ op: 'all', of: [known, unknownLeaf] }, context)).toBe('unknown');
  });

  it('all is true only when every operand is true', () => {
    expect(evaluate({ op: 'all', of: [known, known] }, context)).toBe('true');
  });

  it('any is true as soon as one operand is true, even beside an unknown', () => {
    expect(evaluate({ op: 'any', of: [known, unknownLeaf] }, context)).toBe('true');
  });

  it('any is unknown when nothing is true but something is unknown', () => {
    expect(evaluate({ op: 'any', of: [falseLeaf, unknownLeaf] }, context)).toBe('unknown');
  });

  it('not of unknown stays unknown — this is what stops a branch opening prematurely', () => {
    expect(evaluate({ op: 'not', of: unknownLeaf }, context)).toBe('unknown');
  });

  it('not inverts known truths', () => {
    expect(evaluate({ op: 'not', of: known }, context)).toBe('false');
    expect(evaluate({ op: 'not', of: falseLeaf }, context)).toBe('true');
  });

  it('nests to arbitrary depth', () => {
    const deep: Condition = {
      op: 'all',
      of: [
        { op: 'any', of: [{ op: 'not', of: falseLeaf }, unknownLeaf] },
        { op: 'all', of: [known, { op: 'not', of: { op: 'not', of: known } }] },
      ],
    };
    expect(evaluate(deep, context)).toBe('true');
  });
});

describe('isSatisfied', () => {
  it('treats unknown as not satisfied, so a branch never opens on an unanswered question', () => {
    const condition: Condition = { op: 'not', of: { op: 'equals', questionId: 'q', optionId: 'yes' } };
    expect(evaluate(condition, ctx({}))).toBe('unknown');
    expect(isSatisfied(condition, ctx({}))).toBe(false);
    // …but once the question is answered, the negation does open it.
    expect(isSatisfied(condition, ctx({ q: single('no') }))).toBe(true);
  });
});

describe('grammar parsing', () => {
  it('accepts a well-formed nested condition', () => {
    const parsed = parseCondition({
      op: 'all',
      of: [
        { op: 'equals', questionId: 'q', optionId: 'a' },
        { op: 'any', of: [{ op: 'gt', questionId: 'n', value: 3 }] },
      ],
    });
    expect(parsed.op).toBe('all');
  });

  it.each([
    ['an unknown operator', { op: 'regex', questionId: 'q', pattern: '.*' }],
    ['a missing question id', { op: 'equals', optionId: 'a' }],
    ['an empty combinator', { op: 'all', of: [] }],
    ['a non-numeric threshold', { op: 'gt', questionId: 'q', value: 'three' }],
    ['a negative duration', { op: 'duration_gte', questionId: 'q', days: -1 }],
    ['an implausible age', { op: 'age_gte', years: 500 }],
    ['a bare string', 'q == yes'],
    ['null', null],
  ])('rejects %s', (_name, input) => {
    expect(conditionSchema.safeParse(input).success).toBe(false);
  });

  it('rejects nesting beyond the depth bound', () => {
    let condition: Condition = { op: 'answered', questionId: 'q' };
    for (let i = 0; i < 20; i += 1) condition = { op: 'not', of: condition };
    expect(() => parseCondition(condition)).toThrow(/nesting depth/i);
  });

  it('rejects a between range that can never match', () => {
    const problems = checkConditionStructure({ op: 'between', questionId: 'q', min: 10, max: 2 });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe('inverted_range');
  });
});
