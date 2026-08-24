import { describe, expect, it } from 'vitest';
import {
  MANDATORY_DISCLAIMER,
  assessmentToolJsonSchema,
  findProhibitedTreatmentContent,
  validateAssessment,
  type AiAssessment,
} from './schema.js';
import { PHASE_1_TAXONOMY } from '../taxonomy.js';

const valid = (): AiAssessment => ({
  case_id: 'case_123',
  model_version: 'claude-test-1',
  prompt_version: 'assessment-v3',
  kb_version: 'kb-2026-08-01',
  generated_at: '2026-08-24T10:00:00Z',
  differential_assessment: [
    {
      condition: 'Peptic ulcer disease',
      likelihood: 'moderate',
      supporting_findings: ['Burning epigastric pain relieved by food', 'Symptoms worse at night'],
      contradicting_or_atypical_findings: ['No reported weight loss'],
      suggested_confirmatory_steps: ['Upper GI endoscopy', 'Testing for H. pylori'],
    },
  ],
  red_flags: [
    {
      flag: 'Reported pattern consistent with active upper GI bleeding',
      basis: 'Black tarry stool reported alongside lightheadedness',
      urgency: 'emergency',
    },
  ],
  recommended_next_steps: ['Urgent in-person assessment by a gastroenterologist'],
  clinician_summary:
    'Adult presenting with epigastric pain and reported melaena. Pattern warrants urgent upper GI evaluation.',
  disclaimer: MANDATORY_DISCLAIMER,
});

const expectRejection = (raw: unknown, code: string) => {
  const result = validateAssessment(raw);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a rejection');
  expect(result.rejections.map((rejection) => rejection.code)).toContain(code);
  return result.rejections;
};

describe('a conforming assessment', () => {
  it('validates and resolves each condition to a taxonomy identifier', () => {
    const result = validateAssessment(valid());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.conditionIds).toEqual(['peptic_ulcer_disease']);
  });

  it('accepts a taxonomy identifier as well as its label', () => {
    const candidate = valid();
    candidate.differential_assessment[0]!.condition = 'peptic_ulcer_disease';
    expect(validateAssessment(candidate).ok).toBe(true);
  });
});

describe('a final-diagnosis field cannot enter the record', () => {
  it('rejects the exact field the schema deliberately does not define', () => {
    const rejections = expectRejection(
      { ...valid(), final_diagnosis: 'Peptic ulcer disease' },
      'schema_violation',
    );
    expect(rejections[0]?.details.join(' ')).toMatch(/final_diagnosis|unrecognized/i);
  });

  it.each([
    'diagnosis',
    'confirmed_diagnosis',
    'conclusion',
    'primary_diagnosis',
  ])('rejects the equivalent conclusion field "%s"', (field) => {
    expectRejection({ ...valid(), [field]: 'Crohn disease' }, 'schema_violation');
  });

  it('never repairs — the rejected object is not partially saved', () => {
    const result = validateAssessment({ ...valid(), final_diagnosis: 'x' });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('assessment');
  });
});

describe('schema violations', () => {
  it.each([
    ['a missing required field', (a: AiAssessment) => { delete (a as Partial<AiAssessment>).kb_version; }],
    ['an empty differential', (a: AiAssessment) => { a.differential_assessment = []; }],
    ['an unknown likelihood', (a: AiAssessment) => {
      (a.differential_assessment[0] as { likelihood: string }).likelihood = 'certain';
    }],
    ['an unknown urgency', (a: AiAssessment) => {
      (a.red_flags[0] as { urgency: string }).urgency = 'critical';
    }],
    ['a differential item with no supporting findings', (a: AiAssessment) => {
      a.differential_assessment[0]!.supporting_findings = [];
    }],
    ['a non-ISO timestamp', (a: AiAssessment) => { a.generated_at = 'yesterday'; }],
    ['an over-long clinician summary', (a: AiAssessment) => {
      a.clinician_summary = 'x'.repeat(4001);
    }],
  ])('rejects %s', (_name, mutate) => {
    const candidate = valid();
    mutate(candidate);
    expectRejection(candidate, 'schema_violation');
  });

  it('rejects a plain string or null outright', () => {
    expectRejection('here is my assessment', 'schema_violation');
    expectRejection(null, 'schema_violation');
  });

  it('reports every schema issue, so the retry reminder can be specific', () => {
    const candidate = valid() as Record<string, unknown>;
    delete candidate.kb_version;
    delete candidate.prompt_version;
    const result = validateAssessment(candidate);
    if (result.ok) throw new Error('expected a rejection');
    expect(result.rejections[0]?.details.length).toBeGreaterThanOrEqual(2);
  });
});

describe('the mandatory disclaimer', () => {
  it('rejects an assessment with the disclaimer missing', () => {
    const candidate = valid() as Record<string, unknown>;
    delete candidate.disclaimer;
    expectRejection(candidate, 'missing_disclaimer');
  });

  it('rejects a reworded disclaimer — the text is fixed, not a suggestion', () => {
    const candidate = valid();
    candidate.disclaimer = 'This is AI generated. Please consult a doctor.';
    expectRejection(candidate, 'missing_disclaimer');
  });

  it('states that it is not a diagnosis and that a physician has not yet reviewed it', () => {
    expect(MANDATORY_DISCLAIMER).toContain('not a medical diagnosis');
    expect(MANDATORY_DISCLAIMER).toContain('not yet been reviewed by a physician');
    expect(MANDATORY_DISCLAIMER).toContain('treating doctor');
  });
});

describe('the taxonomy bounds what the model may name', () => {
  it('rejects a condition outside the reviewed taxonomy', () => {
    const candidate = valid();
    candidate.differential_assessment[0]!.condition = 'Acute intermittent porphyria';
    const rejections = expectRejection(candidate, 'off_taxonomy_condition');
    expect(rejections[0]?.details).toContain('Acute intermittent porphyria');
  });

  it('rejects a condition that has been retired from the taxonomy', () => {
    const candidate = valid();
    candidate.differential_assessment[0]!.condition = 'Coeliac disease';
    const retired = PHASE_1_TAXONOMY.map((entry) =>
      entry.id === 'coeliac_disease' ? { ...entry, active: false } : entry,
    );
    const result = validateAssessment(candidate, { taxonomy: retired });
    expect(result.ok).toBe(false);
  });

  it('rejects the same condition listed twice', () => {
    const candidate = valid();
    candidate.differential_assessment.push({ ...candidate.differential_assessment[0]! });
    expectRejection(candidate, 'duplicate_condition');
  });

  it('accepts the single malignancy urgent-referral category', () => {
    const candidate = valid();
    candidate.differential_assessment[0]!.condition =
      'Features that require urgent specialist review to exclude GI malignancy';
    expect(validateAssessment(candidate).ok).toBe(true);
  });

  it('rejects any attempt to differentiate malignancy subtypes', () => {
    const candidate = valid();
    candidate.differential_assessment = [
      { ...candidate.differential_assessment[0]!, condition: 'Gastric carcinoma' },
      { ...candidate.differential_assessment[0]!, condition: 'Colorectal carcinoma' },
    ];
    // Subtypes are not in the taxonomy at all, which is precisely how subdivision is prevented.
    expectRejection(candidate, 'off_taxonomy_condition');
  });

  it('rejects two entries that both resolve to the malignancy category', () => {
    const taxonomy = [
      ...PHASE_1_TAXONOMY,
      {
        id: 'suspected_gi_malignancy_alias',
        label: 'Possible GI malignancy',
        clusters: ['bleeding' as const],
        urgentReferralOnly: true,
        active: true,
      },
    ];
    const candidate = valid();
    candidate.differential_assessment = [
      {
        ...candidate.differential_assessment[0]!,
        condition: 'Features that require urgent specialist review to exclude GI malignancy',
      },
      { ...candidate.differential_assessment[0]!, condition: 'Possible GI malignancy' },
    ];
    const result = validateAssessment(candidate, { taxonomy });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a rejection');
    expect(result.rejections.map((rejection) => rejection.code)).toContain(
      'malignancy_subtype_differentiation',
    );
  });
});

describe('no medication, dose, or treatment plan', () => {
  it.each([
    ['a drug name in the next steps', (a: AiAssessment) => {
      a.recommended_next_steps = ['Start omeprazole'];
    }],
    ['a drug name in a confirmatory step', (a: AiAssessment) => {
      a.differential_assessment[0]!.suggested_confirmatory_steps = ['Trial of pantoprazole'];
    }],
    ['a dose in the clinician summary', (a: AiAssessment) => {
      a.clinician_summary = 'Adult with epigastric pain. Consider a proton pump inhibitor 40 mg.';
    }],
    ['a regimen abbreviation', (a: AiAssessment) => {
      a.recommended_next_steps = ['Acid suppression bd for four weeks'];
    }],
    ['an eradication regimen', (a: AiAssessment) => {
      a.recommended_next_steps = ['Consider triple therapy'];
    }],
    ['a frequency instruction', (a: AiAssessment) => {
      a.recommended_next_steps = ['Take an antacid twice a day'];
    }],
  ])('rejects %s', (_name, mutate) => {
    const candidate = valid();
    mutate(candidate);
    expectRejection(candidate, 'prohibited_treatment_content');
  });

  it('allows investigations, which are not treatment', () => {
    const candidate = valid();
    candidate.recommended_next_steps = [
      'Upper GI endoscopy',
      'Full blood count and iron studies',
      'Abdominal ultrasound',
      'Referral to a gastroenterologist within one week',
    ];
    expect(validateAssessment(candidate).ok).toBe(true);
  });

  it('does not screen the disclaimer, which is fixed text we authored', () => {
    expect(findProhibitedTreatmentContent(valid()).filter((f) => f.field === 'disclaimer')).toEqual(
      [],
    );
  });

  it('names the field and the match, so the retry reminder can be precise', () => {
    const findings = findProhibitedTreatmentContent({
      recommended_next_steps: ['Start omeprazole 20 mg'],
    });
    expect(findings.map((finding) => finding.field)).toContain('recommended_next_steps[0]');
    expect(findings.map((finding) => finding.kind)).toContain('medication_name');
    expect(findings.map((finding) => finding.kind)).toContain('dose_or_regimen');
  });

  it('accepts a clinician-tuned term list', () => {
    const candidate = valid();
    candidate.recommended_next_steps = ['Discuss ranitidine history with the patient'];
    expect(validateAssessment(candidate, { medicationTerms: [] }).ok).toBe(true);
  });
});

describe('the tool JSON Schema matches what the validator enforces', () => {
  const schema = assessmentToolJsonSchema();

  it('forbids additional properties, so the model is told a stray field is invalid', () => {
    expect(schema.additionalProperties).toBe(false);
    const differential = (schema.properties as Record<string, Record<string, unknown>>)
      .differential_assessment as Record<string, Record<string, unknown>>;
    expect((differential.items as Record<string, unknown>).additionalProperties).toBe(false);
  });

  it('offers no final-diagnosis property for the model to fill', () => {
    const properties = Object.keys(schema.properties as Record<string, unknown>);
    expect(properties).not.toContain('final_diagnosis');
    expect(properties.some((key) => key.includes('diagnosis'))).toBe(false);
  });

  it('enumerates exactly the active taxonomy, so the model is given the permitted vocabulary', () => {
    const differential = (schema.properties as Record<string, Record<string, unknown>>)
      .differential_assessment as Record<string, Record<string, Record<string, Record<string, unknown>>>>;
    const conditions = differential.items!.properties!.condition!.enum as string[];
    expect(conditions).toEqual(PHASE_1_TAXONOMY.filter((e) => e.active).map((e) => e.label));
  });

  it('pins the disclaimer as a constant', () => {
    const disclaimer = (schema.properties as Record<string, Record<string, unknown>>).disclaimer;
    expect(disclaimer?.const).toBe(MANDATORY_DISCLAIMER);
  });

  it('requires every field the validator requires', () => {
    expect(schema.required).toEqual([
      'case_id',
      'model_version',
      'prompt_version',
      'kb_version',
      'generated_at',
      'differential_assessment',
      'red_flags',
      'recommended_next_steps',
      'clinician_summary',
      'disclaimer',
    ]);
  });
});
