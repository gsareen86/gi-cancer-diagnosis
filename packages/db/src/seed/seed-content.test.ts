import { describe, expect, it } from 'vitest';
import {
  activeAnswerMap,
  computeInterview,
  evaluateRedFlags,
  indexTemplate,
  compileClinicalSummary,
  createTextResolver,
  validateEscalationCopy,
  validateForPublication,
  type AnswerValue,
  type RecordedAnswer,
} from '@gi-compass/core';
import { buildTemplateDocument, validateSeedContent } from './index';
import { RED_FLAG_RULES } from './red-flags';
import { CLINICAL_TEXT, catalogueGaps, requiredTextKeys } from './text';
import { REFERENCE_IMAGES, isPublishable } from './reference-images';
import { QUESTIONS } from './questions';

/**
 * The seeded clinical content is the product. These tests run it through the same engine a
 * patient will, so a branch that cannot be reached or a red flag that can never fire is caught
 * here rather than in front of someone who is bleeding.
 */

const document = buildTemplateDocument(1);
const index = indexTemplate(document.template);
const resolve = createTextResolver(document, 'en');

const at = new Date('2026-08-01T00:00:00Z');
const answer = (questionId: string, value: AnswerValue): RecordedAnswer => ({
  questionId,
  value,
  answeredAt: at,
  active: true,
});
const select = (optionId: string): AnswerValue => ({ kind: 'single_select', optionId });
const multi = (...optionIds: string[]): AnswerValue => ({ kind: 'multi_select', optionIds });
const days = (n: number): AnswerValue => ({ kind: 'duration', days: n });
const num = (value: number, unit: string): AnswerValue => ({ kind: 'numeric', value, unit });

const interview = (entryPointId: string, answers: RecordedAnswer[], ageYears = 52) =>
  computeInterview({ index, entryPointId, answers, subject: { ageYears } });

const flags = (answers: RecordedAnswer[], ageYears = 52) =>
  evaluateRedFlags({
    ruleSet: RED_FLAG_RULES,
    answers: activeAnswerMap(answers),
    subject: { ageYears },
  });

describe('the seed publishes only content that passes publication validation', () => {
  it('validates cleanly', () => {
    const validation = validateSeedContent();
    expect(validation.problems).toEqual([]);
    expect(validation.ok).toBe(true);
  });

  it('has an acyclic branching graph with every question reachable', () => {
    const result = validateForPublication(document.template, { requiredLocales: ['en'] });
    expect(result.problems.filter((p) => p.code === 'cycle')).toEqual([]);
    expect(result.problems.filter((p) => p.code === 'unreachable_question')).toEqual([]);
  });

  it('pairs every clinical term with a lay explanation that has real text', () => {
    for (const question of QUESTIONS) {
      for (const term of question.clinicalTerms) {
        const explanation = CLINICAL_TEXT.en?.[term.layExplanationKey];
        expect(explanation, `${question.id} / ${term.term}`).toBeDefined();
        expect(explanation!.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('clinical text completeness', () => {
  it('has English text for every key the content resolves', () => {
    const gaps = catalogueGaps().filter((gap) => gap.locale === 'en');
    expect(gaps).toEqual([]);
  });

  it('has Hindi text for every key too, ready for clinician approval', () => {
    const gaps = catalogueGaps().filter((gap) => gap.locale === 'hi');
    expect(gaps).toEqual([]);
  });

  it('publishes English only, because the Hindi clinical text is not yet clinician-approved', () => {
    expect(document.approvedLocales).toEqual(['en']);
    const result = validateForPublication(document.template, { requiredLocales: ['en', 'hi'] });
    expect(result.problems.map((p) => p.code)).toContain('missing_locale_approval');
  });

  it('resolves a real prompt rather than a raw key', () => {
    expect(resolve('q.blood_appearance.prompt')).toBe('What does the blood look like?');
    expect(requiredTextKeys().length).toBeGreaterThan(250);
  });
});

describe('reference images are not publishable until they are attributed', () => {
  it('ships every asset as unattributed, so none reaches a patient by default', () => {
    expect(REFERENCE_IMAGES.every((asset) => !isPublishable(asset))).toBe(true);
  });

  it('every image a question references exists in the library', () => {
    const known = new Set(REFERENCE_IMAGES.map((asset) => asset.key));
    const referenced = new Set<string>();
    for (const question of QUESTIONS) {
      question.referenceImageIds.forEach((id) => referenced.add(id));
      question.options.forEach((option) => option.referenceImageIds.forEach((id) => referenced.add(id)));
    }
    expect([...referenced].filter((id) => !known.has(id))).toEqual([]);
  });
});

describe('the melaena pathway, end to end', () => {
  const path = [
    answer('blood_in_stool', select('yes')),
    answer('blood_appearance', select('black_tarry')),
    answer('lightheaded', select('yes')),
  ];

  it('reveals the follow-ups in order and keeps the chain contiguous', () => {
    const result = interview('ep_bleeding', path);
    const ids = result.activeQuestionIds;
    expect(ids[0]).toBe('blood_in_stool');
    expect(ids).toContain('blood_appearance');
    expect(ids).toContain('lightheaded');
    expect(ids).toContain('fainted');
    expect(ids.indexOf('lightheaded')).toBeLessThan(ids.indexOf('fainted'));
    expect(ids).not.toContain('blood_position');
  });

  it('raises the emergency flag without any AI involvement', () => {
    const result = flags(path);
    expect(result.requiresEmergencyEscalation).toBe(true);
    expect(result.triggered[0]?.ruleId).toBe('rf_upper_gi_bleed_with_hypovolaemia');
  });

  it('escalation copy names no condition', () => {
    for (const flag of flags(path).triggered) {
      expect(validateEscalationCopy(resolve(flag.basisKey))).toEqual([]);
    }
  });

  it('compiles a summary that distinguishes what was denied from what was never asked', () => {
    const withDenial = [...path, answer('weight_loss', select('no'))];
    const result = interview('ep_bleeding', withDenial);
    const summary = compileClinicalSummary({
      caseId: 'case-1',
      index,
      orderedQuestionIds: result.activeQuestionIds,
      answers: withDenial,
      revealedBy: new Map(
        result.activeQuestions.map((entry) => [entry.question.id, entry.revealedByQuestionId]),
      ),
      redFlags: flags(withDenial).triggered,
      documents: [],
      subject: { ageYears: 52, sex: 'male' },
      resolve,
    });

    expect(summary.deniedFindings).toContain('Have you lost weight without trying to?');
    expect(summary.presentFindings.join(' ')).toContain('Black, sticky and tar-like');
    expect(summary.narrative).toContain('not yours to raise, lower, or suppress');
  });
});

describe('the bright-red bleeding pathway', () => {
  it('branches on where the blood is', () => {
    const mixedIn = [
      answer('blood_in_stool', select('yes')),
      answer('blood_appearance', select('bright_red')),
      answer('blood_position', select('mixed_in')),
    ];
    expect(interview('ep_bleeding', mixedIn).activeQuestionIds).toContain('blood_episodes');
    expect(interview('ep_bleeding', mixedIn).activeQuestionIds).not.toContain('anal_symptoms');

    const onPaper = [
      answer('blood_in_stool', select('yes')),
      answer('blood_appearance', select('bright_red')),
      answer('blood_position', select('on_paper_only')),
    ];
    expect(interview('ep_bleeding', onPaper).activeQuestionIds).toContain('anal_symptoms');
    expect(interview('ep_bleeding', onPaper).activeQuestionIds).not.toContain('blood_episodes');
  });

  it('flags frequent bleeding mixed into the stool as urgent', () => {
    const result = flags([
      answer('blood_in_stool', select('yes')),
      answer('blood_appearance', select('bright_red')),
      answer('blood_position', select('mixed_in')),
      answer('blood_episodes', num(6, 'episodes in the past 2 weeks')),
    ]);
    expect(result.triggered.map((flag) => flag.ruleId)).toContain('rf_frequent_mixed_bleeding');
    expect(result.requiresEmergencyEscalation).toBe(false);
  });
});

describe('the obstruction pathway', () => {
  it('needs all three findings before it fires', () => {
    const partial = [
      answer('pain_present', select('yes')),
      answer('abdomen_distended', select('yes')),
      answer('vomiting', select('yes')),
    ];
    expect(flags(partial).requiresEmergencyEscalation).toBe(false);
    expect(interview('ep_pain', partial).activeQuestionIds).toContain('passing_wind_or_stool');

    const complete = [...partial, answer('passing_wind_or_stool', select('neither_for_a_day'))];
    expect(flags(complete).requiresEmergencyEscalation).toBe(true);
    expect(flags(complete).triggered[0]?.ruleId).toBe('rf_possible_obstruction');
  });

  it('does not fire when the patient is passing wind and stool normally', () => {
    const passing = [
      answer('pain_present', select('yes')),
      answer('abdomen_distended', select('yes')),
      answer('vomiting', select('yes')),
      answer('passing_wind_or_stool', select('both_normally')),
    ];
    expect(
      flags(passing).triggered.map((flag) => flag.ruleId),
    ).not.toContain('rf_possible_obstruction');
  });
});

describe('the perforation pathway', () => {
  it('fires on a rigid abdomen with severe pain, and not on a rigid abdomen alone', () => {
    const rigidOnly = [
      answer('pain_present', select('yes')),
      answer('abdomen_rigid', select('yes')),
      answer('pain_severity', { kind: 'scale', value: 3 }),
    ];
    expect(flags(rigidOnly).requiresEmergencyEscalation).toBe(false);

    const severe = [
      answer('pain_present', select('yes')),
      answer('abdomen_rigid', select('yes')),
      answer('pain_severity', { kind: 'scale', value: 9 }),
    ];
    expect(flags(severe).triggered.map((f) => f.ruleId)).toContain('rf_possible_perforation');
  });
});

describe('the liver pathway', () => {
  const jaundiced = [
    answer('jaundice', select('yes')),
    answer('urine_colour', select('tea_or_cola')),
    answer('abdominal_swelling', select('yes')),
    answer('confusion_drowsiness', select('yes')),
  ];

  it('opens at the jaundice question and reveals the decompensation screen', () => {
    const result = interview('ep_liver', jaundiced);
    expect(result.activeQuestionIds[0]).toBe('jaundice');
    expect(result.activeQuestionIds).toContain('leg_swelling');
    expect(result.activeQuestionIds).toContain('easy_bruising');
  });

  it('raises an emergency for jaundice with confusion', () => {
    const result = flags(jaundiced);
    expect(result.requiresEmergencyEscalation).toBe(true);
    expect(result.triggered.map((f) => f.ruleId)).toContain('rf_hepatic_decompensation');
  });

  it('flags new jaundice as urgent even on its own', () => {
    const result = flags([answer('jaundice', select('yes'))]);
    expect(result.highestUrgency).toBe('urgent');
    expect(result.triggered.map((f) => f.ruleId)).toEqual(['rf_new_jaundice']);
  });
});

describe('the reflux pathway', () => {
  it('reveals the swallowing screen and flags progressive dysphagia', () => {
    const path = [
      answer('heartburn', select('yes')),
      answer('heartburn_frequency', select('daily')),
      answer('heartburn_duration', days(2200)),
      answer('swallowing_difficulty', select('solids_and_liquids')),
      answer('swallowing_worsening', select('yes')),
    ];
    const result = interview('ep_reflux', path);
    expect(result.activeQuestionIds).toContain('early_satiety');

    const triggered = flags(path).triggered.map((f) => f.ruleId);
    expect(triggered).toContain('rf_progressive_dysphagia');
    expect(triggered).toContain('rf_longstanding_reflux');
  });
});

describe('the bowel-habit pathway', () => {
  it('flags a persistent change in an over-45 patient and not in a younger one', () => {
    const path = [
      answer('bowel_change', select('yes')),
      answer('bowel_change_direction', multi('looser', 'more_often')),
      answer('bowel_change_duration', days(60)),
    ];
    expect(flags(path, 52).triggered.map((f) => f.ruleId)).toContain(
      'rf_persistent_bowel_change_over_45',
    );
    expect(flags(path, 28).triggered.map((f) => f.ruleId)).not.toContain(
      'rf_persistent_bowel_change_over_45',
    );
  });

  it('reveals the inflammatory-bowel screen when stools are looser', () => {
    const path = [
      answer('bowel_change', select('yes')),
      answer('bowel_change_direction', multi('looser')),
    ];
    const ids = interview('ep_bowel', path).activeQuestionIds;
    expect(ids).toContain('night_time_stools');
    expect(ids).toContain('family_ibd');
  });
});

describe('an entirely negative interview', () => {
  const denied = [answer('blood_in_stool', select('no'))];

  it('opens no symptom follow-up, but still collects history for the reviewing doctor', () => {
    const result = interview('ep_bleeding', denied);
    expect(result.activeQuestionIds).toEqual(['blood_in_stool', 'known_conditions']);
    expect(result.activeQuestionIds).not.toContain('blood_appearance');
    expect(result.nextQuestionId).toBe('known_conditions');
  });

  it('raises no red flag', () => {
    expect(flags(denied).triggered).toEqual([]);
    expect(flags(denied).requiresEmergencyEscalation).toBe(false);
  });

  it('completes once the history question is answered too', () => {
    const complete = [
      ...denied,
      answer('known_conditions', multi('none')),
      answer('current_medications', { kind: 'text', value: '' }),
      answer('other_history', { kind: 'text', value: '' }),
    ];
    expect(interview('ep_bleeding', complete).complete).toBe(true);
  });
});

describe('every red-flag rule can actually fire', () => {
  it('has escalation copy for every rule, none of which names a condition', () => {
    for (const rule of RED_FLAG_RULES.rules) {
      const copy = CLINICAL_TEXT.en?.[rule.basisKey];
      expect(copy, rule.id).toBeDefined();
      expect(validateEscalationCopy(copy!), rule.id).toEqual([]);
    }
  });

  it('reads only questions the template actually asks', () => {
    const questionIds = new Set(QUESTIONS.map((question) => question.id));
    const walk = (node: unknown, found: string[] = []): string[] => {
      if (node === null || typeof node !== 'object') return found;
      const record = node as Record<string, unknown>;
      if (Array.isArray(record.of)) record.of.forEach((child) => walk(child, found));
      else if (record.of !== undefined) walk(record.of, found);
      else if (typeof record.questionId === 'string') found.push(record.questionId);
      return found;
    };
    for (const rule of RED_FLAG_RULES.rules) {
      for (const questionId of walk(rule.when)) {
        expect(questionIds.has(questionId), `${rule.id} reads ${questionId}`).toBe(true);
      }
    }
  });
});
