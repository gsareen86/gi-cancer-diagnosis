import { describe, expect, it } from 'vitest';
import {
  compareUrgency,
  evaluateRedFlags,
  highestUrgencyOf,
  redFlagRuleSetSchema,
  validateEscalationCopy,
  EMERGENCY_CONTACTS,
} from './red-flags';
import type { AnswerValue } from '../questionnaire/answers';
import { bleedingRedFlags } from '../__fixtures__/bleeding-template';

const answers = (entries: Record<string, AnswerValue>) => new Map(Object.entries(entries));
const select = (optionId: string): AnswerValue => ({ kind: 'single_select', optionId });

const evaluate = (entries: Record<string, AnswerValue>, ageYears?: number) =>
  evaluateRedFlags({
    ruleSet: bleedingRedFlags,
    answers: answers(entries),
    subject: ageYears === undefined ? {} : { ageYears },
  });

describe('rule set parsing', () => {
  it('round-trips a valid rule set', () => {
    expect(redFlagRuleSetSchema.parse(bleedingRedFlags).rules).toHaveLength(4);
  });

  it('rejects an unknown urgency rather than defaulting to something lower', () => {
    const result = redFlagRuleSetSchema.safeParse({
      version: 1,
      rules: [{ id: 'r', basisKey: 'k', urgency: 'critical', when: { op: 'answered', questionId: 'q' } }],
    });
    expect(result.success).toBe(false);
  });
});

describe('emergency combination', () => {
  it('fires on black tarry stool AND (lightheadedness OR fainting)', () => {
    const result = evaluate({
      q_blood_appearance: select('black_tarry'),
      q_lightheaded: select('yes'),
    });
    expect(result.requiresEmergencyEscalation).toBe(true);
    expect(result.highestUrgency).toBe('emergency');
    expect(result.triggered[0]?.ruleId).toBe('rf_upper_gi_bleed_with_hypovolaemia');
  });

  it('fires on the other arm of the OR', () => {
    const result = evaluate({
      q_blood_appearance: select('black_tarry'),
      q_lightheaded: select('no'),
      q_fainting: select('yes'),
    });
    expect(result.requiresEmergencyEscalation).toBe(true);
  });

  it('does NOT fire when only one half of the AND holds', () => {
    expect(evaluate({ q_blood_appearance: select('black_tarry') }).requiresEmergencyEscalation).toBe(
      false,
    );
    expect(evaluate({ q_lightheaded: select('yes') }).requiresEmergencyEscalation).toBe(false);
  });

  it('does NOT fire when both halves are explicitly denied', () => {
    const result = evaluate({
      q_blood_appearance: select('bright_red'),
      q_lightheaded: select('no'),
      q_fainting: select('no'),
    });
    expect(result.requiresEmergencyEscalation).toBe(false);
  });

  it('records the answers that formed the basis, so the decision is reconstructable', () => {
    const result = evaluate({
      q_blood_appearance: select('black_tarry'),
      q_lightheaded: select('yes'),
    });
    const flag = result.triggered[0];
    expect(flag?.contributingQuestionIds.sort()).toEqual(['q_blood_appearance', 'q_lightheaded']);
    expect(flag?.ruleSetVersion).toBe(bleedingRedFlags.version);
  });
});

describe('age and threshold rules', () => {
  it('fires the over-45 rule only when age is known and past the threshold', () => {
    const withAge = evaluate({ q_blood: select('yes'), q_weight_loss: select('yes') }, 52);
    expect(withAge.triggered.map((flag) => flag.ruleId)).toContain(
      'rf_bleeding_with_weight_loss_over_45',
    );

    const younger = evaluate({ q_blood: select('yes'), q_weight_loss: select('yes') }, 30);
    expect(younger.triggered.map((flag) => flag.ruleId)).not.toContain(
      'rf_bleeding_with_weight_loss_over_45',
    );

    // An unknown age must not fire the rule — an unknown is never a trigger.
    const unknownAge = evaluate({ q_blood: select('yes'), q_weight_loss: select('yes') });
    expect(unknownAge.triggered.map((flag) => flag.ruleId)).not.toContain(
      'rf_bleeding_with_weight_loss_over_45',
    );
  });

  it('fires the frequency rule above its threshold only', () => {
    const unit = 'episodes in the past 2 weeks';
    const above = evaluate({
      q_blood_position: select('mixed_in'),
      q_blood_frequency: { kind: 'numeric', value: 6, unit },
    });
    expect(above.highestUrgency).toBe('urgent');

    const atThreshold = evaluate({
      q_blood_position: select('mixed_in'),
      q_blood_frequency: { kind: 'numeric', value: 3, unit },
    });
    expect(atThreshold.triggered).toHaveLength(0);
  });

  it('fires the duration rule at exactly the threshold', () => {
    expect(evaluate({ q_blood_duration: { kind: 'duration', days: 14 } }).highestUrgency).toBe(
      'routine-but-flagged',
    );
    expect(evaluate({ q_blood_duration: { kind: 'duration', days: 13 } }).triggered).toHaveLength(0);
  });
});

describe('ordering and urgency', () => {
  it('sorts the most urgent flag first', () => {
    const result = evaluate(
      {
        q_blood: select('yes'),
        q_blood_appearance: select('black_tarry'),
        q_lightheaded: select('yes'),
        q_weight_loss: select('yes'),
        q_blood_duration: { kind: 'duration', days: 30 },
      },
      60,
    );
    expect(result.triggered.map((flag) => flag.urgency)).toEqual([
      'emergency',
      'urgent',
      'routine-but-flagged',
    ]);
    expect(highestUrgencyOf(result.triggered)).toBe('emergency');
  });

  it('compares urgency most-severe-first', () => {
    expect(compareUrgency('emergency', 'urgent')).toBeLessThan(0);
    expect(compareUrgency('routine-but-flagged', 'urgent')).toBeGreaterThan(0);
  });

  it('reports no flags and no escalation for an empty answer set', () => {
    const result = evaluate({});
    expect(result.triggered).toEqual([]);
    expect(result.highestUrgency).toBeNull();
    expect(result.requiresEmergencyEscalation).toBe(false);
  });
});

describe('determinism and speed', () => {
  it('produces the same result every time', () => {
    const input = {
      q_blood: select('yes'),
      q_blood_appearance: select('black_tarry'),
      q_lightheaded: select('yes'),
    };
    const results = Array.from({ length: 50 }, () => JSON.stringify(evaluate(input, 50)));
    expect(new Set(results).size).toBe(1);
  });

  it('evaluates far faster than the 100 ms budget the spec sets', () => {
    const input = {
      q_blood: select('yes'),
      q_blood_appearance: select('black_tarry'),
      q_lightheaded: select('yes'),
      q_weight_loss: select('yes'),
      q_blood_duration: { kind: 'duration' as const, days: 30 },
    };
    const iterations = 2000;
    const started = performance.now();
    for (let i = 0; i < iterations; i += 1) evaluate(input, 50);
    const perEvaluation = (performance.now() - started) / iterations;
    expect(perEvaluation).toBeLessThan(1);
  });
});

describe('escalation copy is symptom-based, never condition-based', () => {
  it('accepts symptom-based wording', () => {
    expect(
      validateEscalationCopy(
        'Your answers suggest a pattern that needs urgent in-person care. Please go to an ' +
          'emergency department now, or call 112.',
      ),
    ).toEqual([]);
  });

  it.each([
    ['you may have a perforation', 'perforation'],
    ['this could be bowel cancer', 'cancer'],
    ['signs of a bleeding ulcer', 'ulcer'],
    ["consistent with Crohn's disease", 'crohn'],
    ['possible cirrhosis', 'cirrhosis'],
  ])('refuses copy that names a condition: %s', (copy, expectedTerm) => {
    const problems = validateEscalationCopy(copy);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.map((problem) => problem.term.toLowerCase())).toContain(expectedTerm);
    expect(problems[0]?.code).toBe('names_a_condition');
  });

  it('is case-insensitive', () => {
    expect(validateEscalationCopy('POSSIBLE MALIGNANCY')).not.toEqual([]);
  });
});

describe('emergency contacts', () => {
  it("exposes India's general emergency and ambulance numbers", () => {
    expect(EMERGENCY_CONTACTS.map((contact) => contact.number)).toEqual(['112', '108']);
  });
});
