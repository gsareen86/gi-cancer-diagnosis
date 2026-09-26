import current from "./content.json";
import previous from "./content-2026-09-21.json";
import firstRevision from "./content-2026-09-22.1.json";

export type Answers = Record<string, string>;
export type Term = { field: string; values: string[] };
export type Question = {
  id: string;
  section: string;
  label: string;
  kind: string;
  options: string[];
  help?: string;
  exclusive?: string[];
  domain?: number;
  showWhen:
    | null
    | { id: string; is?: string; not?: string }
    | { all?: Term[]; any?: Term[] };
};
export type Content = {
  version: string;
  status: string;
  noticeVersion: string;
  urgencies: string[];
  specialties: string[];
  questions: Question[];
  rules: Array<{
    id: string;
    urgency: string;
    reason: string;
    all: Term[];
    source: string;
    provenance: string;
  }>;
  advice: Record<"review" | "prompt" | "immediate", string>;
  specialtyDescriptions?: Record<string, string>;
  investigations?: string[];
  continuationAdvice?: string;
  incompleteAdvice?: string;
  assistedAdvice?: string;
};
export const content = current satisfies Content;
export function contentFor(version = content.version): Content {
  if (version === current.version) return content;
  if (version === firstRevision.version) return firstRevision;
  if (version === previous.version) return previous;
  throw new Error(
    "This questionnaire version is unavailable. Refresh this page or ask clinic staff for help.",
  );
}
export const uncertain = ["Not sure", "Prefer not to answer"];
export function answerValues(question: Question, value = ""): string[] {
  if (!value) return [];
  if (question.kind !== "multi") return [value];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}
export function answerText(question: Question, value = "") {
  return question.kind === "multi"
    ? answerValues(question, value).join(", ")
    : value;
}
export function isActive(
  question: Question,
  answers: Answers,
  doc: Content,
  seen: string[] = [],
): boolean {
  if (seen.includes(question.id)) return false;
  const when = question.showWhen;
  if (!when) return true;
  const next = [...seen, question.id];
  const matches = (term: Term) => {
    const parent = doc.questions.find((q) => q.id === term.field);
    return (
      !!parent &&
      isActive(parent, answers, doc, next) &&
      answerValues(parent, answers[parent.id]).some((v) =>
        term.values.includes(v),
      )
    );
  };
  if ("id" in when) {
    const parent = doc.questions.find((q) => q.id === when.id);
    if (!parent || !isActive(parent, answers, doc, next)) return false;
    const value = answers[when.id];
    return when.is !== undefined
      ? value === when.is
      : !!value && ![...uncertain, when.not].includes(value);
  }
  return (
    (when.all?.every(matches) ?? true) && (when.any?.some(matches) ?? true)
  );
}
export function visibleQuestions(
  section: string,
  answers: Answers,
  version = content.version,
) {
  const doc = contentFor(version);
  return doc.questions.filter(
    (q) => q.section === section && isActive(q, answers, doc),
  );
}
export function activeAnswers(answers: Answers, version = content.version) {
  const doc = contentFor(version);
  return Object.fromEntries(
    doc.questions
      .filter((q) => isActive(q, answers, doc))
      .flatMap((q) =>
        [q.id, `${q.id}__note`]
          .filter((id) => id === q.id || answers[id] !== undefined)
          .map((id) => [id, answers[id] ?? ""]),
      ),
  );
}
export function isValidAnswer(doc: Content, id: string, value: string) {
  const note = id.endsWith("__note");
  const question = doc.questions.find(
    (q) => q.id === (note ? id.slice(0, -6) : id),
  );
  if (
    !question ||
    value.length > 2000 ||
    (note && doc.version === previous.version)
  )
    return false;
  if (note || !value || question.kind === "text") return true;
  const values = answerValues(question, value);
  if (
    !values.length ||
    new Set(values).size !== values.length ||
    values.some((v) => !question.options.includes(v))
  )
    return false;
  const exclusive = [...uncertain, ...(question.exclusive ?? [])];
  return values.length === 1 || !values.some((v) => exclusive.includes(v));
}
