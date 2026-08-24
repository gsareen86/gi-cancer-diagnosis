import { z } from 'zod';

/**
 * Answers are stored as stable identifiers and typed values, never as display text
 * (design D10). That is what makes mid-interview language switching safe and what stops a
 * clinician's wording correction from silently changing the meaning of recorded answers.
 */

export const ANSWER_KINDS = [
  'single_select',
  'multi_select',
  'scale',
  'numeric',
  'date',
  'duration',
  'text',
  'body_map',
  'image',
] as const;

export type AnswerKind = (typeof ANSWER_KINDS)[number];

/** ISO 8601 calendar date, e.g. 2026-03-04. Stored unambiguously regardless of locale. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO 8601 date (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'not a real calendar date');

export const answerValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('single_select'), optionId: z.string().min(1) }),
  z.object({ kind: z.literal('multi_select'), optionIds: z.array(z.string().min(1)) }),
  z.object({ kind: z.literal('scale'), value: z.number().int() }),
  z.object({ kind: z.literal('numeric'), value: z.number().finite(), unit: z.string().min(1) }),
  z.object({ kind: z.literal('date'), value: isoDate }),
  z.object({ kind: z.literal('duration'), days: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('text'), value: z.string() }),
  z.object({ kind: z.literal('body_map'), regionIds: z.array(z.string().min(1)) }),
  /** Inline capture stores document references; the image itself lives in encrypted case storage. */
  z.object({ kind: z.literal('image'), documentIds: z.array(z.string().min(1)) }),
]);

export type AnswerValue = z.infer<typeof answerValueSchema>;

export interface RecordedAnswer {
  questionId: string;
  value: AnswerValue;
  answeredAt: Date;
  /** Retracted answers are kept but excluded from evaluation and from the clinical summary. */
  active: boolean;
}

/** Builds the evaluation view: active answers only, keyed by question. */
export function activeAnswerMap(answers: readonly RecordedAnswer[]): Map<string, AnswerValue> {
  const map = new Map<string, AnswerValue>();
  for (const answer of answers) {
    if (answer.active) map.set(answer.questionId, answer.value);
  }
  return map;
}
