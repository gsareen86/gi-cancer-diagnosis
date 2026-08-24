import type { Condition } from './grammar.js';

/** Every question identifier the condition reads, in first-appearance order, deduplicated. */
export function referencedQuestionIds(condition: Condition): string[] {
  const seen = new Set<string>();
  const walk = (node: Condition): void => {
    switch (node.op) {
      case 'all':
      case 'any':
        node.of.forEach(walk);
        return;
      case 'not':
        walk(node.of);
        return;
      case 'age_gte':
        return;
      default:
        seen.add(node.questionId);
    }
  };
  walk(condition);
  return [...seen];
}

/** Which answer kinds each predicate can meaningfully read. Used by publication validation. */
export const PREDICATE_COMPATIBILITY = {
  answered: null, // any type
  equals: ['single_select', 'multi_select', 'body_map'],
  includes: ['multi_select', 'body_map', 'single_select'],
  gt: ['numeric', 'scale', 'duration'],
  lt: ['numeric', 'scale', 'duration'],
  between: ['numeric', 'scale', 'duration'],
  duration_gte: ['duration'],
} as const;

export type TypedPredicateOp = keyof typeof PREDICATE_COMPATIBILITY;

export interface PredicateUse {
  op: TypedPredicateOp;
  questionId: string;
  optionId?: string;
}

/** Flattens the tree into the leaf predicate uses that read a question. */
export function predicateUses(condition: Condition): PredicateUse[] {
  const uses: PredicateUse[] = [];
  const walk = (node: Condition): void => {
    switch (node.op) {
      case 'all':
      case 'any':
        node.of.forEach(walk);
        return;
      case 'not':
        walk(node.of);
        return;
      case 'age_gte':
        return;
      case 'equals':
      case 'includes':
        uses.push({ op: node.op, questionId: node.questionId, optionId: node.optionId });
        return;
      default:
        uses.push({ op: node.op, questionId: node.questionId });
    }
  };
  walk(condition);
  return uses;
}
