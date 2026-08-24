import { isSatisfied, type EvaluationContext, type EvaluationSubject } from '../conditions/evaluate.js';
import { referencedQuestionIds } from '../conditions/introspect.js';
import type { AnswerValue, RecordedAnswer } from './answers.js';
import { activeAnswerMap } from './answers.js';
import { byOrder, type Question, type TemplateIndex } from './template.js';

/**
 * Computes the adaptive path: which questions the patient is currently being asked, in what
 * order, how far through they are, and which previously-given answers a changed answer has
 * retracted.
 *
 * The computation is a monotone fixpoint. Rules are evaluated only against answers to
 * questions that are themselves reachable, so an answer stranded by a changed branch cannot
 * keep a downstream branch alive. Because the active set only grows within one computation,
 * the loop always terminates.
 */

export interface InterviewInput {
  index: TemplateIndex;
  entryPointId: string;
  answers: readonly RecordedAnswer[];
  subject: EvaluationSubject;
}

export interface ActiveQuestion {
  question: Question;
  /** The answered question whose answer revealed this one; null for entry-group questions. */
  revealedByQuestionId: string | null;
  depth: number;
  answered: boolean;
}

export interface InterviewProgress {
  answered: number;
  total: number;
  /** 0–1 over the *current* path; recomputed whenever the path changes. */
  ratio: number;
}

export interface Interview {
  /** Presentation order: depth-first, so a revealed follow-up immediately follows its trigger. */
  activeQuestions: ActiveQuestion[];
  activeQuestionIds: string[];
  nextQuestionId: string | null;
  progress: InterviewProgress;
  /** Answers stranded by a changed branch. Mark these inactive — never delete them. */
  retractedQuestionIds: string[];
  /** The answers the rules were actually evaluated against. */
  effectiveAnswers: ReadonlyMap<string, AnswerValue>;
  complete: boolean;
}

const MAX_FIXPOINT_ITERATIONS = 1000;

/** Every question some branching rule can reveal, directly or via a revealed group. */
function revealableQuestionIds(index: TemplateIndex): Set<string> {
  const revealable = new Set<string>();
  for (const rule of index.version.rules) {
    for (const questionId of rule.revealQuestionIds) revealable.add(questionId);
    for (const groupId of rule.revealGroupIds) {
      for (const question of index.questionsByGroup.get(groupId) ?? []) revealable.add(question.id);
    }
  }
  return revealable;
}


export function computeInterview(input: InterviewInput): Interview {
  const { index, entryPointId, answers, subject } = input;
  const entryPoint = index.entryPointById.get(entryPointId);
  if (!entryPoint) {
    throw new Error(`Unknown entry point: ${entryPointId}`);
  }

  const allAnswers = activeAnswerMap(answers);

  const active = new Map<string, ActiveQuestion>();
  const addQuestion = (question: Question, revealedBy: string | null, depth: number): boolean => {
    if (active.has(question.id)) return false;
    active.set(question.id, {
      question,
      revealedByQuestionId: revealedBy,
      depth,
      answered: allAnswers.has(question.id),
    });
    return true;
  };

  // Groups are symptom clusters, so a group holds both the questions that open an interview
  // and the follow-ups a rule reveals. Seeding the whole group would make every follow-up
  // active from the first screen, so anything a rule can reveal is excluded from the seed and
  // waits for its trigger.
  const ruleRevealed = revealableQuestionIds(index);
  for (const question of index.questionsByGroup.get(entryPoint.entryGroupId) ?? []) {
    if (ruleRevealed.has(question.id)) continue;
    addQuestion(question, null, 0);
  }

  const restrictAnswers = (): Map<string, AnswerValue> => {
    const restricted = new Map<string, AnswerValue>();
    for (const [questionId, value] of allAnswers) {
      if (active.has(questionId)) restricted.set(questionId, value);
    }
    return restricted;
  };

  let effectiveAnswers = restrictAnswers();
  let iterations = 0;
  let changed = true;

  while (changed) {
    changed = false;
    if (++iterations > MAX_FIXPOINT_ITERATIONS) {
      throw new Error('Interview path computation did not converge; the template graph is malformed');
    }
    const context: EvaluationContext = { answers: effectiveAnswers, subject };

    for (const rule of index.version.rules) {
      if (!isSatisfied(rule.when, context)) continue;

      // The trigger is the deepest *answered and active* question the rule reads. Anchoring
      // the revealed questions to it is what keeps a five-hop chain contiguous instead of
      // scattering follow-ups back into their groups' natural order.
      let trigger: ActiveQuestion | null = null;
      for (const questionId of referencedQuestionIds(rule.when)) {
        const candidate = active.get(questionId);
        if (!candidate || !effectiveAnswers.has(questionId)) continue;
        if (trigger === null || candidate.depth > trigger.depth) trigger = candidate;
      }
      const revealedBy = trigger?.question.id ?? null;
      const depth = trigger === null ? 0 : trigger.depth + 1;

      const revealed: Question[] = [];
      for (const questionId of rule.revealQuestionIds) {
        const question = index.questionById.get(questionId);
        if (question) revealed.push(question);
      }
      for (const groupId of rule.revealGroupIds) {
        revealed.push(...(index.questionsByGroup.get(groupId) ?? []));
      }
      for (const question of revealed) {
        if (addQuestion(question, revealedBy, depth)) changed = true;
      }
    }

    if (changed) effectiveAnswers = restrictAnswers();
  }

  const ordered = orderDepthFirst(active, index);
  const answeredCount = ordered.filter((entry) => entry.answered).length;
  const nextQuestion = ordered.find((entry) => !entry.answered);

  const retracted: string[] = [];
  for (const answer of answers) {
    if (answer.active && !active.has(answer.questionId)) retracted.push(answer.questionId);
  }

  return {
    activeQuestions: ordered,
    activeQuestionIds: ordered.map((entry) => entry.question.id),
    nextQuestionId: nextQuestion?.question.id ?? null,
    progress: {
      answered: answeredCount,
      total: ordered.length,
      ratio: ordered.length === 0 ? 1 : answeredCount / ordered.length,
    },
    retractedQuestionIds: retracted,
    effectiveAnswers,
    complete: nextQuestion === undefined,
  };
}

function orderDepthFirst(
  active: ReadonlyMap<string, ActiveQuestion>,
  index: TemplateIndex,
): ActiveQuestion[] {
  const children = new Map<string | null, ActiveQuestion[]>();
  for (const entry of active.values()) {
    const key = entry.revealedByQuestionId;
    const bucket = children.get(key);
    if (bucket) bucket.push(entry);
    else children.set(key, [entry]);
  }

  const naturalOrder = (a: ActiveQuestion, b: ActiveQuestion): number => {
    const groupA = index.groupById.get(a.question.groupId)?.order ?? Number.MAX_SAFE_INTEGER;
    const groupB = index.groupById.get(b.question.groupId)?.order ?? Number.MAX_SAFE_INTEGER;
    return groupA - groupB || byOrder(a.question, b.question);
  };

  const ordered: ActiveQuestion[] = [];
  const emitted = new Set<string>();
  const visit = (entry: ActiveQuestion): void => {
    if (emitted.has(entry.question.id)) return;
    emitted.add(entry.question.id);
    ordered.push(entry);
    const kids = children.get(entry.question.id);
    if (kids) [...kids].sort(naturalOrder).forEach(visit);
  };

  [...(children.get(null) ?? [])].sort(naturalOrder).forEach(visit);
  // Defensive: a question whose parent is itself unreachable must still be presented.
  [...active.values()].sort(naturalOrder).forEach(visit);
  return ordered;
}

/** True when every *required* active question has an answer — the submission precondition. */
export function unansweredRequiredQuestionIds(interview: Interview): string[] {
  return interview.activeQuestions
    .filter((entry) => entry.question.required && !entry.answered)
    .map((entry) => entry.question.id);
}
