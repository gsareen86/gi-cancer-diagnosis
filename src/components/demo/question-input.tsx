"use client";
import { answerText, answerValues, type Answers } from "@/lib/demo/clinical";
import { uncertain, type Question } from "@/lib/demo/questionnaire";

export function QuestionInput({
  question: q,
  answers,
  onChange,
  legacy = false,
}: {
  question: Question;
  answers: Answers;
  onChange: (id: string, value: string) => void;
  legacy?: boolean;
}) {
  const selected = answerValues(q, answers[q.id]);
  function choose(option: string) {
    if (q.kind !== "multi") return onChange(q.id, option);
    const exclusive = [...uncertain, ...(q.exclusive ?? [])];
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : exclusive.includes(option)
        ? [option]
        : [...selected.filter((v) => !exclusive.includes(v)), option];
    onChange(q.id, next.length ? JSON.stringify(next) : "");
  }
  return (
    <>
      {q.help && (
        <p className="question-help" id={`${q.id}-help`}>
          {q.help}
        </p>
      )}
      {q.kind === "choice" || q.kind === "multi" ? (
        <div
          className={
            q.id === "pain_site" ? "body-map-options" : "answer-options"
          }
        >
          {q.options.map((option) => (
            <label
              key={option}
              className={
                selected.includes(option) ? "answer selected" : "answer"
              }
            >
              <input
                type={q.kind === "multi" ? "checkbox" : "radio"}
                name={q.id}
                value={option}
                checked={selected.includes(option)}
                onChange={() => choose(option)}
                aria-describedby={q.help ? `${q.id}-help` : undefined}
              />
              {option}
            </label>
          ))}
        </div>
      ) : (
        <>
          <textarea
            aria-label={q.label}
            aria-describedby={q.help ? `${q.id}-help` : undefined}
            rows={3}
            value={answers[q.id] ?? ""}
            maxLength={2000}
            onChange={(e) => onChange(q.id, e.target.value)}
          />
          <div className="actions">
            {uncertain.map((value) => (
              <button
                key={value}
                className="link-button"
                onClick={() => onChange(q.id, value)}
              >
                {value}
              </button>
            ))}
          </div>
        </>
      )}
      {!legacy && (
        <details
          className="answer-detail"
          open={answers[`${q.id}__note`] ? true : undefined}
        >
          <summary>Add a detail in your own words (optional)</summary>
          <label htmlFor={`${q.id}-note`}>
            Anything the options do not capture
          </label>
          <textarea
            id={`${q.id}-note`}
            rows={2}
            maxLength={2000}
            value={answers[`${q.id}__note`] ?? ""}
            onChange={(e) => onChange(`${q.id}__note`, e.target.value)}
          />
          <small>
            Tell clinic staff directly if you need help now. This detail will be
            available for review.
          </small>
        </details>
      )}
    </>
  );
}

export function AnswerSummary({
  questions,
  answers,
  active,
}: {
  questions: Question[];
  answers: Answers;
  active: Answers;
}) {
  return (
    <dl className="answer-review">
      {questions.map((q) => (
        <div key={q.id}>
          <dt>{q.label}</dt>
          <dd>
            {answerText(q, answers[q.id]) ||
              (Object.hasOwn(active, q.id)
                ? "Not yet answered"
                : "Not asked for the current selections")}
            {!Object.hasOwn(active, q.id) &&
              (answers[q.id] || answers[`${q.id}__note`]) && (
                <small className="block">
                  Earlier answer — does not apply to the current selections.
                  Please check if this needs correcting.
                </small>
              )}
            {answers[`${q.id}__note`] && (
              <p>Additional detail: {answers[`${q.id}__note`]}</p>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
