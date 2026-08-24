import { answerValueSchema, type AnswerValue } from './answers';
import type { Question } from './template';

/**
 * Per-type answer contracts. An answer failing its contract is rejected, never stored —
 * a stored answer that violates its question's constraints would silently corrupt every
 * downstream rule evaluation and the clinical summary the doctor reads.
 */

export type AnswerRejectionCode =
  | 'malformed'
  | 'type_mismatch'
  | 'unknown_option'
  | 'duplicate_option'
  | 'too_many_options'
  | 'empty_selection'
  | 'out_of_range'
  | 'not_an_integer'
  | 'wrong_unit'
  | 'unknown_region'
  | 'too_long'
  | 'missing_constraint';

export interface AnswerRejection {
  code: AnswerRejectionCode;
  message: string;
  /** Machine-readable detail for the client to render inline, e.g. the permitted range. */
  detail?: Record<string, unknown>;
}

export type AnswerValidation =
  | { ok: true; value: AnswerValue }
  | { ok: false; rejection: AnswerRejection };

const reject = (
  code: AnswerRejectionCode,
  message: string,
  detail?: Record<string, unknown>,
): AnswerValidation => ({
  ok: false,
  rejection: detail === undefined ? { code, message } : { code, message, detail },
});

export function validateAnswer(question: Question, raw: unknown): AnswerValidation {
  const parsed = answerValueSchema.safeParse(raw);
  if (!parsed.success) {
    return reject('malformed', 'Answer is not a well-formed answer value', {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  const value = parsed.data;

  if (value.kind !== question.type) {
    return reject('type_mismatch', `Question expects a ${question.type} answer`, {
      expected: question.type,
      received: value.kind,
    });
  }

  switch (value.kind) {
    case 'single_select': {
      const optionIds = new Set(question.options.map((option) => option.id));
      if (!optionIds.has(value.optionId)) {
        return reject('unknown_option', 'Selected option is not defined on this question', {
          optionId: value.optionId,
        });
      }
      return { ok: true, value };
    }

    case 'multi_select': {
      if (value.optionIds.length === 0 && question.required) {
        return reject('empty_selection', 'Select at least one option');
      }
      if (new Set(value.optionIds).size !== value.optionIds.length) {
        return reject('duplicate_option', 'The same option was selected more than once');
      }
      const optionIds = new Set(question.options.map((option) => option.id));
      const unknown = value.optionIds.filter((id) => !optionIds.has(id));
      if (unknown.length > 0) {
        return reject('unknown_option', 'One or more options are not defined on this question', {
          optionIds: unknown,
        });
      }
      if (question.multiSelectMax !== undefined && value.optionIds.length > question.multiSelectMax) {
        return reject('too_many_options', `Select at most ${question.multiSelectMax} options`, {
          max: question.multiSelectMax,
        });
      }
      return { ok: true, value };
    }

    case 'scale': {
      if (!question.scale) {
        return reject('missing_constraint', 'Scale question has no scale constraint configured');
      }
      const { min, max } = question.scale;
      if (value.value < min || value.value > max) {
        return reject('out_of_range', `Answer must be between ${min} and ${max}`, { min, max });
      }
      return { ok: true, value };
    }

    case 'numeric': {
      if (!question.numeric) {
        return reject('missing_constraint', 'Numeric question has no range configured');
      }
      const { min, max, unit, integerOnly } = question.numeric;
      if (value.unit !== unit) {
        return reject('wrong_unit', `Answer must be given in ${unit}`, { expected: unit });
      }
      if (integerOnly && !Number.isInteger(value.value)) {
        return reject('not_an_integer', 'Answer must be a whole number');
      }
      if (value.value < min || value.value > max) {
        return reject('out_of_range', `Answer must be between ${min} and ${max} ${unit}`, {
          min,
          max,
          unit,
        });
      }
      return { ok: true, value };
    }

    case 'body_map': {
      if (value.regionIds.length === 0 && question.required) {
        return reject('empty_selection', 'Select at least one area');
      }
      if (new Set(value.regionIds).size !== value.regionIds.length) {
        return reject('duplicate_option', 'The same area was selected more than once');
      }
      const regions = new Set(question.bodyMapRegionIds);
      const unknown = value.regionIds.filter((id) => !regions.has(id));
      if (unknown.length > 0) {
        return reject('unknown_region', 'One or more areas are not defined on this body map', {
          regionIds: unknown,
        });
      }
      return { ok: true, value };
    }

    case 'text': {
      if (value.value.length > question.textMaxLength) {
        return reject('too_long', `Answer must be at most ${question.textMaxLength} characters`, {
          max: question.textMaxLength,
        });
      }
      return { ok: true, value };
    }

    case 'date':
    case 'duration':
    case 'image':
      return { ok: true, value };
  }
}
