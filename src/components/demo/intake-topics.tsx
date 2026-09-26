"use client";
import { useEffect, useRef } from "react";
import {
  flowFor,
  intakeTopics,
  type IntakeTopic,
  type IntakeNavigation,
} from "@/lib/demo/intake-flow";
import type { Answers } from "@/lib/demo/clinical";
import { QuestionInput, AnswerSummary } from "./question-input";
import { contentFor, activeAnswers, isActive } from "@/lib/demo/questionnaire";

export function TopicQuestions({
  topic,
  version,
  answers,
  mode,
  onChange,
  onNavigate,
  busy,
  assisted = false,
}: {
  topic: IntakeTopic;
  version: string;
  answers: Answers;
  mode: "main" | "detail";
  onChange: (id: string, value: string) => void;
  onNavigate: (step: number, navigation?: IntakeNavigation) => void;
  busy: boolean;
  assisted?: boolean;
}) {
  const layout = flowFor(version)!;
  const topics = intakeTopics(version, answers);
  const covered = topics.filter((t) => t.complete).length;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [topic.id, mode]);
  const choose = (t: IntakeTopic) =>
    onNavigate(t.step, { flowVersion: layout.version, topicId: t.id, mode });
  const index = topics.findIndex((t) => t.id === topic.id);
  return (
    <>
      <div className="intake-progress">
        <div>
          <strong>
            {mode === "detail" ? "Optional detail" : "Your main questions"}
          </strong>
          <span>
            {mode === "detail"
              ? "Add what you know, then return to review"
              : `${covered} of ${topics.length} topics answered`}
          </span>
        </div>
        {mode === "main" && (
          <progress
            aria-label="Main topics answered"
            max={topics.length}
            value={covered}
          />
        )}
      </div>
      <div className="question-layout topic-layout">
        <section className="panel topic-questions">
          <p className="eyebrow">
            {mode === "detail" ? "More about" : "Current topic"}
          </p>
          <h2 ref={heading} tabIndex={-1}>
            {topic.label}
          </h2>
          <p className="muted">
            {mode === "detail"
              ? "Answer only what you want to add. Unanswered details remain unknown."
              : "Related questions are together. Follow-ups appear only when relevant."}
          </p>
          {assisted && contentFor(version).assistedAdvice && (
            <p className="question-help">
              {contentFor(version).assistedAdvice}
            </p>
          )}
          {topic.questions.map((q) => (
            <fieldset className="question-card" key={q.id}>
              <legend>{q.label}</legend>
              <QuestionInput
                question={q}
                answers={answers}
                onChange={onChange}
              />
            </fieldset>
          ))}
        </section>
        <aside className="panel topic-map">
          <h2>{mode === "detail" ? "At your pace" : "In this section"}</h2>
          {mode === "main" ? (
            <ol>
              {topics
                .filter((t) => t.step === topic.step)
                .map((t) => (
                  <li key={t.id}>
                    <button
                      className={t.id === topic.id ? "active" : ""}
                      disabled={busy}
                      aria-current={t.id === topic.id ? "step" : undefined}
                      onClick={() => choose(t)}
                    >
                      <span>{t.label}</span>
                      <small>
                        {t.complete
                          ? "Answered"
                          : t.answered
                            ? "In progress"
                            : "To answer"}
                      </small>
                    </button>
                  </li>
                ))}
            </ol>
          ) : (
            <p>These questions are optional. Your main answers stay saved.</p>
          )}
          <p>{layout.intro}</p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => onNavigate(6)}
          >
            {mode === "detail" ? "Back to review" : "Review answers so far"}
          </button>
        </aside>
      </div>
      <div className="topic-navigation">
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            mode === "detail"
              ? onNavigate(6)
              : index > 0
                ? choose(topics[index - 1])
                : onNavigate(1)
          }
        >
          ← Back
        </button>
        <button
          disabled={busy}
          onClick={() =>
            mode === "detail"
              ? onNavigate(6)
              : index < topics.length - 1
                ? choose(topics[index + 1])
                : onNavigate(5)
          }
        >
          {mode === "detail"
            ? "Save and return to review"
            : index === topics.length - 1
              ? "Finish main questions"
              : "Continue →"}
        </button>
      </div>
    </>
  );
}

export function OptionalTopics({
  version,
  answers,
  busy,
  onNavigate,
}: {
  version: string;
  answers: Answers;
  busy: boolean;
  onNavigate: (step: number, navigation: IntakeNavigation) => void;
}) {
  const layout = flowFor(version);
  if (!layout) return null;
  const topics = intakeTopics(version, answers, "detail");
  return (
    <section className="panel optional-topics">
      <p className="eyebrow">Optional</p>
      <h2>Want to add more detail?</h2>
      <p>{layout.optionalIntro}</p>
      <div>
        {topics.map((t) => (
          <button
            className="secondary"
            key={t.id}
            disabled={busy}
            onClick={() =>
              onNavigate(t.step, {
                flowVersion: layout.version,
                topicId: t.id,
                mode: "detail",
              })
            }
          >
            {t.label}
            <small>{t.complete ? "Details added" : "Add detail"}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function TopicAnswerReview({
  version,
  answers,
}: {
  version: string;
  answers: Answers;
}) {
  const layout = flowFor(version)!;
  const doc = contentFor(version);
  const active = activeAnswers(answers, version);
  return (
    <div className="topic-answer-review">
      <p>
        Open a topic to check or discuss the recorded answers. Optional details
        left out remain unknown.
      </p>
      {layout.topics.map((t) => {
        const questions = [...t.essential, ...t.details].flatMap((id) => {
          const q = doc.questions.find((q) => q.id === id);
          return q &&
            ((t.essential.includes(id) && isActive(q, answers, doc)) ||
              answers[id] ||
              answers[id + "__note"])
            ? [q]
            : [];
        });
        if (!questions.length) return null;
        const answered = questions.filter((q) => answers[q.id]).length;
        return (
          <details key={t.id}>
            <summary>
              <strong>{t.label}</strong>
              <span>
                {answered ? `${answered} answers recorded` : "Not answered"}
              </span>
            </summary>
            <AnswerSummary
              questions={questions}
              answers={answers}
              active={active}
            />
          </details>
        );
      })}
    </div>
  );
}
