import { describe, expect, it } from 'vitest';
import { computeInterview, unansweredRequiredQuestionIds } from './interview.js';
import { indexTemplate } from './template.js';
import type { AnswerValue, RecordedAnswer } from './answers.js';
import { bleedingTemplate } from '../__fixtures__/bleeding-template.js';

const index = indexTemplate(bleedingTemplate);

const answer = (questionId: string, value: AnswerValue, active = true): RecordedAnswer => ({
  questionId,
  value,
  answeredAt: new Date('2026-08-01T00:00:00Z'),
  active,
});
const select = (optionId: string): AnswerValue => ({ kind: 'single_select', optionId });

const run = (answers: RecordedAnswer[], ageYears = 52) =>
  computeInterview({ index, entryPointId: 'ep_bleeding', answers, subject: { ageYears } });

describe('entry point seeding', () => {
  it('starts with the entry group only, so the patient is never asked to name a disease', () => {
    const interview = run([]);
    expect(interview.activeQuestionIds).toEqual(['q_blood']);
    expect(interview.nextQuestionId).toBe('q_blood');
    expect(interview.progress).toEqual({ answered: 0, total: 1, ratio: 0 });
  });

  it('rejects an unknown entry point rather than silently starting empty', () => {
    expect(() =>
      computeInterview({ index, entryPointId: 'ep_nonexistent', answers: [], subject: {} }),
    ).toThrow(/unknown entry point/i);
  });

  it('a different entry point starts a different path', () => {
    const interview = computeInterview({
      index,
      entryPointId: 'ep_bowel',
      answers: [],
      subject: {},
    });
    expect(interview.activeQuestionIds).toEqual(['q_bowel_change']);
  });
});

describe('multi-hop chains', () => {
  it('walks the full five-hop melaena chain, keeping follow-ups contiguous', () => {
    const interview = run([
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('black_tarry')),
      answer('q_lightheaded', select('yes')),
    ]);

    // q_lightheaded and q_fainting live in grp_systemic (group order 2) while the bleeding
    // follow-ups live in grp_bleeding (order 0). Natural group order would scatter them; the
    // depth-first ordering keeps the chain together immediately after its trigger.
    expect(interview.activeQuestionIds).toEqual([
      'q_blood',
      'q_blood_appearance',
      'q_lightheaded',
      'q_fainting',
      'q_blood_duration',
      'q_weight_loss',
    ]);
    expect(interview.nextQuestionId).toBe('q_fainting');
  });

  it('records how deep each revealed question sits and what revealed it', () => {
    const interview = run([
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('bright_red')),
      answer('q_blood_position', select('mixed_in')),
    ]);
    const byId = new Map(interview.activeQuestions.map((entry) => [entry.question.id, entry]));

    expect(byId.get('q_blood')?.depth).toBe(0);
    expect(byId.get('q_blood_appearance')?.revealedByQuestionId).toBe('q_blood');
    expect(byId.get('q_blood_position')?.revealedByQuestionId).toBe('q_blood_appearance');
    expect(byId.get('q_blood_frequency')?.revealedByQuestionId).toBe('q_blood_position');
    expect(byId.get('q_blood_frequency')?.depth).toBe(3);
  });

  it('follows the other arm of the branch', () => {
    const interview = run([
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('bright_red')),
      answer('q_blood_position', select('coats_separate')),
    ]);
    expect(interview.activeQuestionIds).toContain('q_anal_symptoms');
    expect(interview.activeQuestionIds).not.toContain('q_blood_frequency');
  });

  it('opens nothing when the gating answer says no', () => {
    const interview = run([answer('q_blood', select('no'))]);
    expect(interview.activeQuestionIds).toEqual(['q_blood']);
    expect(interview.complete).toBe(true);
  });

  it('opens nothing on an indeterminate answer', () => {
    const interview = run([answer('q_blood', select('unsure'))]);
    expect(interview.activeQuestionIds).toEqual(['q_blood']);
  });
});

describe('retraction when an earlier answer changes', () => {
  it('withdraws the questions the previous answer had revealed and reports their answers as retracted', () => {
    const deepPath = [
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('bright_red')),
      answer('q_blood_position', select('mixed_in')),
      answer('q_blood_frequency', { kind: 'numeric', value: 6, unit: 'episodes in the past 2 weeks' }),
    ];
    expect(run(deepPath).activeQuestionIds).toContain('q_blood_frequency');

    // The patient goes back and changes the appearance answer.
    const changed = [
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('black_tarry')),
      ...deepPath.slice(2),
    ];
    const interview = run(changed);

    expect(interview.activeQuestionIds).not.toContain('q_blood_position');
    expect(interview.activeQuestionIds).not.toContain('q_blood_frequency');
    expect(interview.retractedQuestionIds.sort()).toEqual(['q_blood_frequency', 'q_blood_position']);
    expect(interview.activeQuestionIds).toContain('q_lightheaded');
  });

  it('excludes a stranded answer from rule evaluation, so it cannot keep a downstream branch alive', () => {
    // q_blood_position is stranded by the black_tarry answer, yet it still holds "mixed_in".
    // If the fixpoint evaluated rules over *all* answers, q_blood_frequency would stay active.
    const interview = run([
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('black_tarry')),
      answer('q_blood_position', select('mixed_in')),
    ]);
    expect(interview.effectiveAnswers.has('q_blood_position')).toBe(false);
    expect(interview.activeQuestionIds).not.toContain('q_blood_frequency');
  });

  it('never counts an already-inactive answer', () => {
    const interview = run([
      answer('q_blood', select('yes')),
      answer('q_blood_position', select('mixed_in'), false),
    ]);
    expect(interview.retractedQuestionIds).toEqual([]);
    expect(interview.effectiveAnswers.has('q_blood_position')).toBe(false);
  });
});

describe('progress', () => {
  it('is computed over the current path, not a fixed step count', () => {
    const before = run([answer('q_blood', select('yes'))]);
    expect(before.progress.total).toBe(4);
    expect(before.progress.answered).toBe(1);

    const after = run([
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('bright_red')),
    ]);
    // Answering opened a new branch, so the denominator grew rather than the ratio jumping.
    expect(after.progress.total).toBeGreaterThan(before.progress.total);
    expect(after.progress.answered).toBe(2);
  });

  it('reports a complete interview once every active question is answered', () => {
    const interview = run([
      answer('q_blood', select('no')),
    ]);
    expect(interview.complete).toBe(true);
    expect(interview.progress.ratio).toBe(1);
    expect(unansweredRequiredQuestionIds(interview)).toEqual([]);
  });

  it('names the unanswered required questions that block submission', () => {
    const interview = run([answer('q_blood', select('yes'))]);
    expect(unansweredRequiredQuestionIds(interview)).toEqual([
      'q_blood_appearance',
      'q_blood_duration',
      'q_weight_loss',
    ]);
  });
});

describe('determinism', () => {
  it('produces an identical path for the same answer set, regardless of answer array order', () => {
    const answers = [
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('bright_red')),
      answer('q_blood_position', select('coats_separate')),
    ];
    const forward = run(answers);
    const reversed = run([...answers].reverse());
    expect(reversed.activeQuestionIds).toEqual(forward.activeQuestionIds);
    expect(reversed.progress).toEqual(forward.progress);
  });

  it('is stable across repeated evaluation', () => {
    const answers = [
      answer('q_blood', select('yes')),
      answer('q_blood_appearance', select('black_tarry')),
      answer('q_lightheaded', select('yes')),
    ];
    const runs = Array.from({ length: 25 }, () => run(answers).activeQuestionIds.join(','));
    expect(new Set(runs).size).toBe(1);
  });
});
