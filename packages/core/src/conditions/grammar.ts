import { z } from 'zod';

/**
 * A closed, JSON-encoded condition grammar shared by branching rules and red-flag rules
 * (design D6). Deliberately not a scripting language: every rule an admin authors must be
 * statically analysable — we need to prove the branching graph is acyclic, that every
 * predicate matches the type of the question it reads, and that a rule cannot smuggle in
 * arbitrary behaviour from an admin form.
 */

export type LeafCondition =
  /** True when the question has an active answer. The only predicate that is never `unknown`. */
  | { op: 'answered'; questionId: string }
  /** Single-select equality. */
  | { op: 'equals'; questionId: string; optionId: string }
  /** Multi-select / body-map membership. */
  | { op: 'includes'; questionId: string; optionId: string }
  | { op: 'gt'; questionId: string; value: number }
  | { op: 'lt'; questionId: string; value: number }
  | { op: 'between'; questionId: string; min: number; max: number }
  | { op: 'duration_gte'; questionId: string; days: number }
  /** Reads the subject's age, not an answer. */
  | { op: 'age_gte'; years: number };

export type Condition =
  | LeafCondition
  | { op: 'all'; of: Condition[] }
  | { op: 'any'; of: Condition[] }
  | { op: 'not'; of: Condition };

export const LEAF_OPS = [
  'answered',
  'equals',
  'includes',
  'gt',
  'lt',
  'between',
  'duration_gte',
  'age_gte',
] as const;

export const COMBINATOR_OPS = ['all', 'any', 'not'] as const;

const questionId = z.string().min(1);
const optionId = z.string().min(1);

export const leafConditionSchema: z.ZodType<LeafCondition> = z.discriminatedUnion('op', [
  z.object({ op: z.literal('answered'), questionId }),
  z.object({ op: z.literal('equals'), questionId, optionId }),
  z.object({ op: z.literal('includes'), questionId, optionId }),
  z.object({ op: z.literal('gt'), questionId, value: z.number().finite() }),
  z.object({ op: z.literal('lt'), questionId, value: z.number().finite() }),
  z.object({ op: z.literal('between'), questionId, min: z.number().finite(), max: z.number().finite() }),
  z.object({ op: z.literal('duration_gte'), questionId, days: z.number().int().nonnegative() }),
  z.object({ op: z.literal('age_gte'), years: z.number().int().min(0).max(130) }),
]);

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    leafConditionSchema,
    z.object({ op: z.literal('all'), of: z.array(conditionSchema).min(1) }),
    z.object({ op: z.literal('any'), of: z.array(conditionSchema).min(1) }),
    z.object({ op: z.literal('not'), of: conditionSchema }),
  ]),
);

/** Guards against an admin pasting a pathologically nested tree. */
export const MAX_CONDITION_DEPTH = 12;

export function isCombinator(
  condition: Condition,
): condition is Extract<Condition, { op: 'all' | 'any' | 'not' }> {
  return condition.op === 'all' || condition.op === 'any' || condition.op === 'not';
}

export function conditionDepth(condition: Condition): number {
  if (condition.op === 'all' || condition.op === 'any') {
    return 1 + Math.max(...condition.of.map(conditionDepth));
  }
  if (condition.op === 'not') return 1 + conditionDepth(condition.of);
  return 1;
}

export interface ConditionStructuralProblem {
  code: 'depth_exceeded' | 'inverted_range';
  message: string;
}

/**
 * Structural checks Zod cannot express: the depth bound, and `between` with min > max — a
 * range that can never match, which would otherwise publish as a rule that silently never fires.
 */
export function checkConditionStructure(condition: Condition): ConditionStructuralProblem[] {
  const problems: ConditionStructuralProblem[] = [];
  const depth = conditionDepth(condition);
  if (depth > MAX_CONDITION_DEPTH) {
    problems.push({
      code: 'depth_exceeded',
      message: `Condition nesting depth ${depth} exceeds the maximum of ${MAX_CONDITION_DEPTH}`,
    });
  }
  const walk = (node: Condition): void => {
    if (node.op === 'all' || node.op === 'any') {
      node.of.forEach(walk);
      return;
    }
    if (node.op === 'not') {
      walk(node.of);
      return;
    }
    if (node.op === 'between' && node.min > node.max) {
      problems.push({
        code: 'inverted_range',
        message: `between on "${node.questionId}" has min ${node.min} greater than max ${node.max}, so it can never match`,
      });
    }
  };
  walk(condition);
  return problems;
}

/** Parses and additionally enforces the structural checks Zod alone cannot express. */
export function parseCondition(input: unknown): Condition {
  const condition = conditionSchema.parse(input);
  const problems = checkConditionStructure(condition);
  if (problems.length > 0) {
    throw new Error(problems.map((problem) => problem.message).join('; '));
  }
  return condition;
}
