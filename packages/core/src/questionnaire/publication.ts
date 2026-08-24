import { conditionDepth, MAX_CONDITION_DEPTH } from '../conditions/grammar';
import { predicateUses, referencedQuestionIds, PREDICATE_COMPATIBILITY } from '../conditions/introspect';
import { indexTemplate, type TemplateVersion } from './template';

/**
 * Publication validation. A published template version is immutable and immediately visible
 * to patients, so every structural problem must be caught here rather than surfacing as a
 * patient stuck in a loop or a rule that can never fire.
 */

export type PublicationProblemCode =
  | 'cycle'
  | 'unknown_reveal_target'
  | 'unknown_group'
  | 'unknown_referenced_question'
  | 'predicate_type_mismatch'
  | 'unknown_option_in_rule'
  | 'unreachable_question'
  | 'missing_lay_explanation'
  | 'condition_too_deep'
  | 'unknown_entry_group'
  | 'unknown_seed_question'
  | 'self_reveal'
  | 'missing_locale_approval';

export interface PublicationProblem {
  code: PublicationProblemCode;
  message: string;
  ruleId?: string;
  questionId?: string;
  /** For `cycle`, the question identifiers forming the loop, in order. */
  path?: string[];
}

export interface PublicationResult {
  ok: boolean;
  problems: PublicationProblem[];
}

export interface PublicationOptions {
  /** Locales the template claims to serve; each needs clinician-approved clinical text. */
  requiredLocales?: readonly string[];
}

export function validateForPublication(
  version: TemplateVersion,
  options: PublicationOptions = {},
): PublicationResult {
  const problems: PublicationProblem[] = [];
  const index = indexTemplate(version);
  const questionIds = new Set(version.questions.map((q) => q.id));
  const groupIds = new Set(version.groups.map((g) => g.id));

  for (const entryPoint of version.entryPoints) {
    if (!groupIds.has(entryPoint.entryGroupId)) {
      problems.push({
        code: 'unknown_entry_group',
        message: `Entry point "${entryPoint.id}" belongs to unknown group "${entryPoint.entryGroupId}"`,
      });
    }
    for (const questionId of entryPoint.seedQuestionIds) {
      if (!questionIds.has(questionId)) {
        problems.push({
          code: 'unknown_seed_question',
          message: `Entry point "${entryPoint.id}" opens with unknown question "${questionId}"`,
          questionId,
        });
      }
    }
  }

  for (const question of version.questions) {
    if (!groupIds.has(question.groupId)) {
      problems.push({
        code: 'unknown_group',
        message: `Question "${question.id}" belongs to unknown group "${question.groupId}"`,
        questionId: question.id,
      });
    }
    for (const term of question.clinicalTerms) {
      if (!term.layExplanationKey.trim()) {
        problems.push({
          code: 'missing_lay_explanation',
          message: `Question "${question.id}" uses the clinical term "${term.term}" with no lay explanation`,
          questionId: question.id,
        });
      }
    }
  }

  for (const rule of version.rules) {
    if (conditionDepth(rule.when) > MAX_CONDITION_DEPTH) {
      problems.push({
        code: 'condition_too_deep',
        message: `Rule "${rule.id}" nests conditions deeper than ${MAX_CONDITION_DEPTH}`,
        ruleId: rule.id,
      });
    }

    for (const questionId of referencedQuestionIds(rule.when)) {
      if (!questionIds.has(questionId)) {
        problems.push({
          code: 'unknown_referenced_question',
          message: `Rule "${rule.id}" reads unknown question "${questionId}"`,
          ruleId: rule.id,
          questionId,
        });
      }
    }

    for (const use of predicateUses(rule.when)) {
      const question = index.questionById.get(use.questionId);
      if (!question) continue;
      const compatible = PREDICATE_COMPATIBILITY[use.op];
      if (compatible !== null && !(compatible as readonly string[]).includes(question.type)) {
        problems.push({
          code: 'predicate_type_mismatch',
          message: `Rule "${rule.id}" applies "${use.op}" to question "${use.questionId}" of type "${question.type}"`,
          ruleId: rule.id,
          questionId: use.questionId,
        });
      }
      if (use.optionId !== undefined) {
        const known =
          question.options.some((option) => option.id === use.optionId) ||
          question.bodyMapRegionIds.includes(use.optionId);
        if (!known) {
          problems.push({
            code: 'unknown_option_in_rule',
            message: `Rule "${rule.id}" reads option "${use.optionId}" which question "${use.questionId}" does not define`,
            ruleId: rule.id,
            questionId: use.questionId,
          });
        }
      }
    }

    for (const questionId of rule.revealQuestionIds) {
      if (!questionIds.has(questionId)) {
        problems.push({
          code: 'unknown_reveal_target',
          message: `Rule "${rule.id}" reveals unknown question "${questionId}"`,
          ruleId: rule.id,
          questionId,
        });
      }
      if (referencedQuestionIds(rule.when).includes(questionId)) {
        problems.push({
          code: 'self_reveal',
          message: `Rule "${rule.id}" reveals question "${questionId}", which its own condition reads`,
          ruleId: rule.id,
          questionId,
        });
      }
    }
    for (const groupId of rule.revealGroupIds) {
      if (!groupIds.has(groupId)) {
        problems.push({
          code: 'unknown_reveal_target',
          message: `Rule "${rule.id}" reveals unknown group "${groupId}"`,
          ruleId: rule.id,
        });
      }
    }
  }

  problems.push(...detectCycles(version));
  problems.push(...detectUnreachable(version));

  for (const locale of options.requiredLocales ?? []) {
    if (!version.approvedLocales.includes(locale)) {
      problems.push({
        code: 'missing_locale_approval',
        message: `Clinical text for locale "${locale}" has not been clinician-approved for this version`,
      });
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * The dependency graph runs from each question a rule *reads* to each question it *reveals*.
 * A cycle means a question can only appear once it has already been answered.
 */
function detectCycles(version: TemplateVersion): PublicationProblem[] {
  const index = indexTemplate(version);
  const edges = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string): void => {
    const bucket = edges.get(from);
    if (bucket) bucket.add(to);
    else edges.set(from, new Set([to]));
  };

  for (const rule of version.rules) {
    const sources = referencedQuestionIds(rule.when);
    const targets = [
      ...rule.revealQuestionIds,
      ...rule.revealGroupIds.flatMap((groupId) =>
        (index.questionsByGroup.get(groupId) ?? []).map((q) => q.id),
      ),
    ];
    for (const source of sources) for (const target of targets) addEdge(source, target);
  }

  const problems: PublicationProblem[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const reported = new Set<string>();

  const visit = (node: string): void => {
    const current = state.get(node);
    if (current === 'done') return;
    if (current === 'visiting') {
      const start = stack.indexOf(node);
      const cycle = [...stack.slice(start), node];
      const signature = [...cycle].sort().join('>');
      if (!reported.has(signature)) {
        reported.add(signature);
        problems.push({
          code: 'cycle',
          message: `Branching rules form a cycle: ${cycle.join(' → ')}`,
          path: cycle,
        });
      }
      return;
    }
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of edges.get(node) ?? []) visit(next);
    stack.pop();
    state.set(node, 'done');
  };

  for (const node of edges.keys()) visit(node);
  return problems;
}

/** A question no entry group contains and no rule reveals can never be asked. */
function detectUnreachable(version: TemplateVersion): PublicationProblem[] {
  const index = indexTemplate(version);
  const reachable = new Set<string>();
  for (const entryPoint of version.entryPoints) {
    for (const questionId of entryPoint.seedQuestionIds) reachable.add(questionId);
  }
  for (const rule of version.rules) {
    for (const questionId of rule.revealQuestionIds) reachable.add(questionId);
    for (const groupId of rule.revealGroupIds) {
      for (const question of index.questionsByGroup.get(groupId) ?? []) reachable.add(question.id);
    }
  }
  return version.questions
    .filter((question) => !reachable.has(question.id))
    .map((question) => ({
      code: 'unreachable_question' as const,
      message: `Question "${question.id}" opens no entry point and no rule reveals it`,
      questionId: question.id,
    }));
}
