import { describe, expect, it } from 'vitest';
import { validateForPublication } from './publication.js';
import type { TemplateVersion } from './template.js';
import { bleedingTemplate } from '../__fixtures__/bleeding-template.js';

const clone = (): TemplateVersion => structuredClone(bleedingTemplate);
const codes = (template: TemplateVersion, requiredLocales?: string[]) =>
  validateForPublication(
    template,
    requiredLocales === undefined ? {} : { requiredLocales },
  ).problems.map((problem) => problem.code);

describe('a well-formed template', () => {
  it('publishes cleanly', () => {
    const result = validateForPublication(bleedingTemplate);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('cycles', () => {
  it('refuses a template where a question transitively depends on itself, naming the loop', () => {
    const template = clone();
    // q_blood → q_blood_appearance already exists; close the loop the other way.
    template.rules.push({
      id: 'r_cycle',
      when: { op: 'equals', questionId: 'q_blood_appearance', optionId: 'bright_red' },
      revealQuestionIds: ['q_blood'],
      revealGroupIds: [],
    });

    const result = validateForPublication(template);
    expect(result.ok).toBe(false);
    const cycle = result.problems.find((problem) => problem.code === 'cycle');
    expect(cycle).toBeDefined();
    expect(cycle?.path).toContain('q_blood');
    expect(cycle?.path).toContain('q_blood_appearance');
    expect(cycle?.message).toMatch(/cycle/i);
  });

  it('refuses a self-referential rule', () => {
    const template = clone();
    template.rules.push({
      id: 'r_self',
      when: { op: 'answered', questionId: 'q_weight_loss' },
      revealQuestionIds: ['q_weight_loss'],
      revealGroupIds: [],
    });
    expect(codes(template)).toContain('self_reveal');
  });

  it('detects a longer cycle spanning three questions', () => {
    const template = clone();
    template.rules.push(
      {
        id: 'r_a',
        when: { op: 'answered', questionId: 'q_anal_symptoms' },
        revealQuestionIds: ['q_bowel_change'],
        revealGroupIds: [],
      },
      {
        id: 'r_b',
        when: { op: 'answered', questionId: 'q_bowel_change' },
        revealQuestionIds: ['q_blood'],
        revealGroupIds: [],
      },
    );
    expect(codes(template)).toContain('cycle');
  });
});

describe('dangling references', () => {
  it('refuses a rule that reveals a question that does not exist', () => {
    const template = clone();
    template.rules[0]!.revealQuestionIds.push('q_retired');
    expect(codes(template)).toContain('unknown_reveal_target');
  });

  it('refuses a rule that reveals a group that does not exist', () => {
    const template = clone();
    template.rules[0]!.revealGroupIds.push('grp_gone');
    expect(codes(template)).toContain('unknown_reveal_target');
  });

  it('refuses a rule that reads a question that does not exist', () => {
    const template = clone();
    template.rules.push({
      id: 'r_ghost',
      when: { op: 'equals', questionId: 'q_ghost', optionId: 'yes' },
      revealQuestionIds: ['q_bowel_change'],
      revealGroupIds: [],
    });
    expect(codes(template)).toContain('unknown_referenced_question');
  });

  it('refuses an entry point pointing at a group that does not exist', () => {
    const template = clone();
    template.entryPoints[0]!.entryGroupId = 'grp_gone';
    expect(codes(template)).toContain('unknown_entry_group');
  });

  it('refuses a question in a group that does not exist', () => {
    const template = clone();
    template.questions[0]!.groupId = 'grp_gone';
    expect(codes(template)).toContain('unknown_group');
  });
});

describe('predicate and option agreement', () => {
  it('refuses a numeric predicate applied to a single-select question', () => {
    const template = clone();
    template.rules.push({
      id: 'r_mismatch',
      when: { op: 'gt', questionId: 'q_blood', value: 3 },
      revealQuestionIds: ['q_bowel_change'],
      revealGroupIds: [],
    });
    const problems = validateForPublication(template).problems;
    const mismatch = problems.find((problem) => problem.code === 'predicate_type_mismatch');
    expect(mismatch?.message).toContain('q_blood');
    expect(mismatch?.message).toContain('single_select');
  });

  it('refuses duration_gte on a numeric question', () => {
    const template = clone();
    template.rules.push({
      id: 'r_dur',
      when: { op: 'duration_gte', questionId: 'q_blood_frequency', days: 3 },
      revealQuestionIds: ['q_bowel_change'],
      revealGroupIds: [],
    });
    expect(codes(template)).toContain('predicate_type_mismatch');
  });

  it('refuses a rule reading an option the question does not define', () => {
    const template = clone();
    template.rules.push({
      id: 'r_bad_option',
      when: { op: 'equals', questionId: 'q_blood', optionId: 'maybe' },
      revealQuestionIds: ['q_bowel_change'],
      revealGroupIds: [],
    });
    expect(codes(template)).toContain('unknown_option_in_rule');
  });

  it('allows `answered` on any question type', () => {
    const template = clone();
    template.rules.push({
      id: 'r_answered',
      when: { op: 'answered', questionId: 'q_blood_duration' },
      revealQuestionIds: ['q_bowel_change'],
      revealGroupIds: [],
    });
    expect(codes(template)).not.toContain('predicate_type_mismatch');
  });
});

describe('reachability', () => {
  it('refuses a question no entry group holds and no rule reveals', () => {
    const template = clone();
    template.questions.push({
      ...structuredClone(template.questions[0]!),
      id: 'q_orphan',
      groupId: 'grp_systemic',
      order: 9,
    });
    const problems = validateForPublication(template).problems;
    const unreachable = problems.find((problem) => problem.code === 'unreachable_question');
    expect(unreachable?.questionId).toBe('q_orphan');
  });
});

describe('plain language', () => {
  it('refuses a clinical term with an empty lay explanation', () => {
    const template = clone();
    const question = template.questions.find((candidate) => candidate.id === 'q_blood_appearance')!;
    question.clinicalTerms = [{ term: 'melaena', layExplanationKey: '   ' }];
    expect(codes(template)).toContain('missing_lay_explanation');
  });
});

describe('locale approval', () => {
  it('publishes a locale whose clinical text a clinician approved', () => {
    expect(codes(bleedingTemplate, ['en', 'hi'])).not.toContain('missing_locale_approval');
  });

  it('refuses a locale whose clinical text has not been approved', () => {
    expect(codes(bleedingTemplate, ['en', 'ta'])).toContain('missing_locale_approval');
  });
});

describe('multiple problems', () => {
  it('reports every problem at once rather than stopping at the first', () => {
    const template = clone();
    template.entryPoints[0]!.entryGroupId = 'grp_gone';
    template.rules[0]!.revealQuestionIds.push('q_missing');
    template.rules.push({
      id: 'r_mismatch',
      when: { op: 'gt', questionId: 'q_blood', value: 1 },
      revealQuestionIds: ['q_bowel_change'],
      revealGroupIds: [],
    });

    const problems = validateForPublication(template).problems;
    expect(new Set(problems.map((problem) => problem.code))).toEqual(
      new Set([
        'unknown_entry_group',
        'unknown_reveal_target',
        'predicate_type_mismatch',
        // Breaking the entry point orphans the questions that group held, so reachability
        // legitimately fails too. Reporting the consequence alongside the cause is what lets
        // the admin see the whole blast radius in one pass.
        'unreachable_question',
      ]),
    );
  });
});
