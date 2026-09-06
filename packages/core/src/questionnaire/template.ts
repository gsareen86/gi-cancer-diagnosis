import { z } from 'zod';
import { conditionSchema } from '../conditions/grammar';
import { ANSWER_KINDS } from './answers';
import { symptomClusterSchema } from '../taxonomy';

/**
 * Clinical content is data, never code (spec: questionnaire/engine). A published template
 * version is immutable and a case pins the version it started on (design D9), so a patient
 * mid-interview never has the ground shift under answers already given, and a doctor reading
 * a case a year later sees the questions exactly as they were asked.
 */

export const questionTypeSchema = z.enum(ANSWER_KINDS);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const answerOptionSchema = z.object({
  id: z.string().min(1),
  /** i18n catalogue key — display text is never stored on the answer. */
  labelKey: z.string().min(1),
  order: z.number().int().nonnegative(),
  referenceImageIds: z.array(z.string()).default([]),
  /**
   * What selecting this option asserts clinically. This is what lets the summary compiler
   * record a symptom as *explicitly denied* rather than merely unmentioned — the distinction
   * the reviewing doctor and the model both need.
   */
  polarity: z.enum(['affirms', 'denies', 'indeterminate']).default('indeterminate'),
});
export type AnswerOption = z.infer<typeof answerOptionSchema>;

export const numericConstraintSchema = z.object({
  min: z.number(),
  max: z.number(),
  unit: z.string().min(1),
  integerOnly: z.boolean().default(false),
});

export const scaleConstraintSchema = z.object({
  min: z.number().int(),
  max: z.number().int(),
  /** Anchor labels shown at each end, as catalogue keys. */
  minLabelKey: z.string().min(1),
  maxLabelKey: z.string().min(1),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  type: questionTypeSchema,
  promptKey: z.string().min(1),
  helpKey: z.string().optional(),
  /** Clinical terms used in the prompt, each of which must carry a lay explanation key. */
  clinicalTerms: z
    .array(z.object({ term: z.string().min(1), layExplanationKey: z.string().min(1) }))
    .default([]),
  options: z.array(answerOptionSchema).default([]),
  numeric: numericConstraintSchema.optional(),
  scale: scaleConstraintSchema.optional(),
  /** Region identifiers for a body-map question; the answer stores these, never coordinates. */
  bodyMapRegionIds: z.array(z.string().min(1)).default([]),
  referenceImageIds: z.array(z.string()).default([]),
  required: z.boolean().default(true),
  order: z.number().int().nonnegative(),
  multiSelectMax: z.number().int().positive().optional(),
  textMaxLength: z.number().int().positive().default(2000),
});
export type Question = z.infer<typeof questionSchema>;

export const questionGroupSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string().min(1),
  /** The clinical cluster this group belongs to; drives retrieval filtering and the doctor's view. */
  cluster: symptomClusterSchema,
  order: z.number().int().nonnegative(),
});
export type QuestionGroup = z.infer<typeof questionGroupSchema>;

export const branchingRuleSchema = z.object({
  id: z.string().min(1),
  when: conditionSchema,
  revealQuestionIds: z.array(z.string().min(1)).default([]),
  revealGroupIds: z.array(z.string().min(1)).default([]),
});
export type BranchingRule = z.infer<typeof branchingRuleSchema>;

/**
 * The patient picks a symptom area, never a disease. Each area names the group the
 * interview starts from.
 */
export const entryPointSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string().min(1),
  /** The cluster this area belongs to. Organizational — it does not decide what is asked first. */
  entryGroupId: z.string().min(1),
  /**
   * Exactly the questions this area opens with. Declared rather than inferred: a group is a
   * symptom cluster holding both opening questions and rule-revealed follow-ups, and the same
   * question can open one area while being a follow-up in another — right-upper-quadrant pain
   * reveals the jaundice question, which is also where the liver area starts.
   */
  seedQuestionIds: z.array(z.string().min(1)).min(1),
  order: z.number().int().nonnegative(),
});
export type EntryPoint = z.infer<typeof entryPointSchema>;

export const templateVersionSchema = z.object({
  templateId: z.string().min(1),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'published', 'retired']),
  entryPoints: z.array(entryPointSchema).min(1),
  groups: z.array(questionGroupSchema).min(1),
  questions: z.array(questionSchema),
  rules: z.array(branchingRuleSchema).default([]),
  /** Shared, version-pinned safety questions and follow-ups, independent of symptom entry. */
  safety: z.object({
    questionIds: z.array(z.string().min(1)),
    rules: z.array(branchingRuleSchema).default([]),
  }).optional(),
  /** Languages whose clinical text a clinician has approved for this version. */
  approvedLocales: z.array(z.string().min(2)).default(['en']),
});
export type TemplateVersion = z.infer<typeof templateVersionSchema>;

/** Indexed view built once per interview computation. */
export interface TemplateIndex {
  version: TemplateVersion;
  questionById: ReadonlyMap<string, Question>;
  groupById: ReadonlyMap<string, QuestionGroup>;
  questionsByGroup: ReadonlyMap<string, readonly Question[]>;
  entryPointById: ReadonlyMap<string, EntryPoint>;
}

function byOrder<T extends { order: number; id: string }>(a: T, b: T): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

export function indexTemplate(version: TemplateVersion): TemplateIndex {
  const questionById = new Map(version.questions.map((q) => [q.id, q]));
  const groupById = new Map(version.groups.map((g) => [g.id, g]));
  const questionsByGroup = new Map<string, Question[]>();
  for (const group of version.groups) questionsByGroup.set(group.id, []);
  for (const question of [...version.questions].sort(byOrder)) {
    const bucket = questionsByGroup.get(question.groupId);
    if (bucket) bucket.push(question);
    else questionsByGroup.set(question.groupId, [question]);
  }
  return {
    version,
    questionById,
    groupById,
    questionsByGroup,
    entryPointById: new Map(version.entryPoints.map((e) => [e.id, e])),
  };
}

export { byOrder };
