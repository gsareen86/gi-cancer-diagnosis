import { describe, expect, it } from 'vitest';
import { computeInterview, evaluateRedFlags, indexTemplate, type AnswerValue, type RecordedAnswer } from '@gi-compass/core';
import { buildTemplateVersion } from './index';
import { QUESTIONS } from './questions';
import { RED_FLAG_RULES } from './red-flags';

const select = (optionId: string): AnswerValue => ({ kind: 'single_select', optionId });
function patientFacts(): RecordedAnswer[] {
  const values = new Map<string, AnswerValue>();
  for (const q of QUESTIONS) {
    if (q.type === 'single_select') values.set(q.id, select(q.options.find(o => o.id === 'no')?.id ?? q.options.find(o => o.id === 'unsure')?.id ?? q.options[0]!.id));
    if (q.type === 'multi_select') values.set(q.id, { kind: 'multi_select', optionIds: [] });
    if (q.type === 'scale') values.set(q.id, { kind: 'scale', value: 3 });
    if (q.type === 'numeric') values.set(q.id, { kind: 'numeric', value: q.numeric!.min, unit: q.numeric!.unit });
    if (q.type === 'duration') values.set(q.id, { kind: 'duration', days: 2 });
    if (q.type === 'body_map') values.set(q.id, { kind: 'body_map', regionIds: ['periumbilical'] });
    if (q.type === 'text') values.set(q.id, { kind: 'text', value: 'Not known' });
  }
  for (const id of ['pain_present', 'vomiting', 'unable_to_keep_fluids_down', 'passing_much_less_urine', 'lightheaded']) values.set(id, select('yes'));
  values.set('vomit_appearance', select('food_only'));
  values.set('pain_pattern', select('constant'));
  values.set('pain_radiates', { kind: 'multi_select', optionIds: ['nowhere'] });
  return [...values].map(([questionId, value]) => ({ questionId, value, answeredAt: new Date('2026-09-06T00:00:00Z'), active: true }));
}

const safety = {
  questionIds: ['pain_present', 'vomiting', 'blood_in_stool', 'jaundice', 'swallowing_difficulty', 'weight_loss', 'bowel_change', 'heartburn'],
  rules: [{ id: 'safety_fluids', when: { op: 'equals' as const, questionId: 'unable_to_keep_fluids_down', optionId: 'yes' }, revealQuestionIds: ['passing_much_less_urine', 'lightheaded'], revealGroupIds: [] }],
};

describe('actual-answer safety coverage (synthetic content, not clinical validation)', () => {
  it.each([5, 9])('reproduces the failure with %i hypothetical universal graph seeds', count => {
    const roots = ['abdomen_rigid', 'pain_severity', 'abdomen_distended', 'vomiting', 'pain_site', 'swallowing_difficulty', 'heartburn_duration', 'heartburn_frequency', 'bowel_change'].slice(0, count);
    const template = buildTemplateVersion(1);
    template.entryPoints = template.entryPoints.map(e => ({ ...e, seedQuestionIds: [...new Set([...e.seedQuestionIds, ...roots])] }));
    const result = computeInterview({ index: indexTemplate(template), entryPointId: 'ep_pain', answers: patientFacts(), subject: { ageYears: 52 } });
    expect(result.complete).toBe(true);
    expect(result.activeQuestionIds).not.toContain('passing_much_less_urine');
    expect(evaluateRedFlags({ ruleSet: RED_FLAG_RULES, answers: result.effectiveAnswers, subject: { ageYears: 52 } }).triggered.map(f => f.ruleId)).not.toContain('rf_severe_dehydration');
  });

  it.each(['ep_pain', 'ep_bowel', 'ep_bleeding', 'ep_reflux', 'ep_liver'])('collects fluid-loss follow-ups through %s without unrelated positive symptoms', entryPointId => {
    const template = { ...buildTemplateVersion(2), safety };
    const result = computeInterview({ index: indexTemplate(template), entryPointId, answers: patientFacts(), subject: { ageYears: 52 } });
    expect(result.activeQuestionIds).toContain('passing_much_less_urine');
    expect(result.activeQuestionIds).toContain('lightheaded');
    expect(evaluateRedFlags({ ruleSet: RED_FLAG_RULES, answers: result.effectiveAnswers, subject: { ageYears: 52 } }).triggered.map(f => f.ruleId)).toContain('rf_severe_dehydration');
  });
});
