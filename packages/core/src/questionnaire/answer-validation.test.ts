import { describe, expect, it } from 'vitest';
import { validateAnswer } from './answer-validation';
import { indexTemplate, type Question } from './template';
import { bleedingTemplate } from '../__fixtures__/bleeding-template';

const index = indexTemplate(bleedingTemplate);
const question = (id: string): Question => {
  const found = index.questionById.get(id);
  if (!found) throw new Error(`fixture missing question ${id}`);
  return found;
};

const expectRejection = (result: ReturnType<typeof validateAnswer>, code: string) => {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a rejection');
  expect(result.rejection.code).toBe(code);
  return result.rejection;
};

describe('type agreement', () => {
  it('rejects an answer whose kind does not match the question', () => {
    const rejection = expectRejection(
      validateAnswer(question('q_blood'), { kind: 'text', value: 'yes' }),
      'type_mismatch',
    );
    expect(rejection.detail).toMatchObject({ expected: 'single_select', received: 'text' });
  });

  it('rejects a structurally malformed answer', () => {
    expectRejection(validateAnswer(question('q_blood'), { kind: 'single_select' }), 'malformed');
    expectRejection(validateAnswer(question('q_blood'), 'yes'), 'malformed');
    expectRejection(validateAnswer(question('q_blood'), null), 'malformed');
  });
});

describe('single select', () => {
  it('accepts a defined option', () => {
    expect(validateAnswer(question('q_blood'), { kind: 'single_select', optionId: 'yes' }).ok).toBe(
      true,
    );
  });

  it('rejects an option the question does not define', () => {
    const rejection = expectRejection(
      validateAnswer(question('q_blood'), { kind: 'single_select', optionId: 'maybe' }),
      'unknown_option',
    );
    expect(rejection.detail).toMatchObject({ optionId: 'maybe' });
  });
});

describe('multi select', () => {
  const q = () => question('q_anal_symptoms');

  it('accepts several defined options', () => {
    expect(
      validateAnswer(q(), { kind: 'multi_select', optionIds: ['pain', 'lump'] }).ok,
    ).toBe(true);
  });

  it('rejects an unknown option and names it', () => {
    const rejection = expectRejection(
      validateAnswer(q(), { kind: 'multi_select', optionIds: ['pain', 'bleeding'] }),
      'unknown_option',
    );
    expect(rejection.detail).toMatchObject({ optionIds: ['bleeding'] });
  });

  it('rejects a repeated option', () => {
    expectRejection(
      validateAnswer(q(), { kind: 'multi_select', optionIds: ['pain', 'pain'] }),
      'duplicate_option',
    );
  });

  it('rejects an empty selection on a required question', () => {
    expectRejection(validateAnswer(q(), { kind: 'multi_select', optionIds: [] }), 'empty_selection');
  });

  it('allows an empty selection when the question is optional', () => {
    const optional: Question = { ...q(), required: false };
    expect(validateAnswer(optional, { kind: 'multi_select', optionIds: [] }).ok).toBe(true);
  });

  it('enforces a configured maximum', () => {
    const capped: Question = { ...q(), multiSelectMax: 2 };
    const rejection = expectRejection(
      validateAnswer(capped, { kind: 'multi_select', optionIds: ['pain', 'itching', 'lump'] }),
      'too_many_options',
    );
    expect(rejection.detail).toMatchObject({ max: 2 });
  });
});

describe('numeric', () => {
  const unit = 'episodes in the past 2 weeks';
  const q = () => question('q_blood_frequency');

  it('accepts a value inside the declared range', () => {
    expect(validateAnswer(q(), { kind: 'numeric', value: 6, unit }).ok).toBe(true);
  });

  it('rejects a value above the declared range and names the range', () => {
    const rejection = expectRejection(
      validateAnswer(q(), { kind: 'numeric', value: 40, unit }),
      'out_of_range',
    );
    expect(rejection.detail).toMatchObject({ min: 0, max: 20, unit });
    expect(rejection.message).toContain('0');
    expect(rejection.message).toContain('20');
  });

  it('rejects a value below the declared range', () => {
    expectRejection(validateAnswer(q(), { kind: 'numeric', value: -1, unit }), 'out_of_range');
  });

  it('rejects a fractional value on an integer-only question', () => {
    expectRejection(validateAnswer(q(), { kind: 'numeric', value: 2.5, unit }), 'not_an_integer');
  });

  it('rejects a mismatched unit rather than silently reinterpreting it', () => {
    expectRejection(
      validateAnswer(q(), { kind: 'numeric', value: 6, unit: 'per day' }),
      'wrong_unit',
    );
  });

  it('rejects when the question has no range configured', () => {
    const misconfigured: Question = { ...q(), numeric: undefined };
    expectRejection(
      validateAnswer(misconfigured, { kind: 'numeric', value: 6, unit }),
      'missing_constraint',
    );
  });
});

describe('body map', () => {
  const bodyMap: Question = {
    ...question('q_anal_symptoms'),
    id: 'q_pain_site',
    type: 'body_map',
    options: [],
    bodyMapRegionIds: ['ruq', 'luq', 'epigastrium', 'rlq', 'llq'],
  };

  it('stores selected region identifiers, not coordinates', () => {
    const result = validateAnswer(bodyMap, { kind: 'body_map', regionIds: ['ruq', 'epigastrium'] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ kind: 'body_map', regionIds: ['ruq', 'epigastrium'] });
  });

  it('rejects a region the map does not define', () => {
    const rejection = expectRejection(
      validateAnswer(bodyMap, { kind: 'body_map', regionIds: ['left_shoulder'] }),
      'unknown_region',
    );
    expect(rejection.detail).toMatchObject({ regionIds: ['left_shoulder'] });
  });
});

describe('scale, date, duration, and text', () => {
  const scaleQuestion: Question = {
    ...question('q_blood'),
    id: 'q_pain_severity',
    type: 'scale',
    options: [],
    scale: { min: 0, max: 10, minLabelKey: 'scale.none', maxLabelKey: 'scale.worst' },
  };

  it('accepts a scale value at both ends', () => {
    expect(validateAnswer(scaleQuestion, { kind: 'scale', value: 0 }).ok).toBe(true);
    expect(validateAnswer(scaleQuestion, { kind: 'scale', value: 10 }).ok).toBe(true);
  });

  it('rejects a scale value beyond the anchors', () => {
    expectRejection(validateAnswer(scaleQuestion, { kind: 'scale', value: 11 }), 'out_of_range');
  });

  it('accepts an ISO date and rejects an ambiguous or impossible one', () => {
    const dateQuestion: Question = { ...question('q_blood'), type: 'date', options: [] };
    expect(validateAnswer(dateQuestion, { kind: 'date', value: '2026-03-04' }).ok).toBe(true);
    expectRejection(validateAnswer(dateQuestion, { kind: 'date', value: '03/04/2026' }), 'malformed');
    expectRejection(validateAnswer(dateQuestion, { kind: 'date', value: '2026-13-45' }), 'malformed');
  });

  it('rejects a negative duration', () => {
    expectRejection(
      validateAnswer(question('q_blood_duration'), { kind: 'duration', days: -3 }),
      'malformed',
    );
  });

  it('caps free text at the configured length', () => {
    const textQuestion: Question = {
      ...question('q_blood'),
      type: 'text',
      options: [],
      textMaxLength: 10,
    };
    expect(validateAnswer(textQuestion, { kind: 'text', value: 'short' }).ok).toBe(true);
    expectRejection(
      validateAnswer(textQuestion, { kind: 'text', value: 'x'.repeat(11) }),
      'too_long',
    );
  });
});
