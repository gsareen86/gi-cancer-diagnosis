import flow from "./intake-flow.json";
import {
  contentFor,
  isActive,
  type Answers,
  type Question,
} from "./questionnaire";

export type IntakeNavigation = {
  flowVersion: string;
  topicId: string;
  mode: "main" | "detail";
};
export type IntakeTopic = (typeof flow.topics)[number] & {
  questions: Question[];
  answered: number;
  complete: boolean;
};
export function flowFor(version: string) {
  return flow.contentVersion === version ? flow : null;
}
export function intakeTopics(
  version: string,
  answers: Answers,
  mode: "main" | "detail" = "main",
): IntakeTopic[] {
  const layout = flowFor(version);
  if (!layout) return [];
  const doc = contentFor(version);
  return layout.topics
    .map((topic) => {
      const ids = mode === "main" ? topic.essential : topic.details;
      const questions = ids.flatMap((id) => {
        const q = doc.questions.find((q) => q.id === id);
        return q && isActive(q, answers, doc) ? [q] : [];
      });
      const answered = questions.filter((q) => !!answers[q.id]?.trim()).length;
      return {
        ...topic,
        questions,
        answered,
        complete: questions.length > 0 && answered === questions.length,
      };
    })
    .filter((topic) => topic.questions.length > 0);
}
export function currentTopic(
  version: string,
  answers: Answers,
  step: number,
  navigation?: IntakeNavigation,
) {
  const layout = flowFor(version);
  if (!layout) return undefined;
  const valid = navigation?.flowVersion === layout.version;
  const topics = intakeTopics(
    version,
    answers,
    valid ? navigation.mode : "main",
  ).filter((t) => t.step === step);
  return (
    topics.find((t) => t.id === navigation?.topicId) ??
    topics.find((t) => !t.complete) ??
    topics[0]
  );
}
