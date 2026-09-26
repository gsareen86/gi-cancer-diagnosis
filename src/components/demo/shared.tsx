"use client";
import { useState } from "react";
import {
  content,
  contentFor,
  answerText,
  evaluate,
  urgencyNames,
  type Answers,
  type Urgency,
} from "@/lib/demo/clinical";
import type { Encounter } from "@/lib/demo/types";

export function notifyPatientReset() {
  const channel = new BroadcastChannel("gi-compass-patient-session");
  channel.postMessage("ended");
  channel.close();
}
export async function action<T = Encounter>(
  name: string,
  id: string | null,
  payload: unknown = {},
  patient = false,
): Promise<T> {
  const response = await fetch("/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: name, id, payload, patient }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error(result.error || "Request unavailable");
  return result.data as T;
}
export function UrgencyBanner({
  answers = {},
  minimum,
  contentVersion = content.version,
  continuing = false,
  showIncomplete = !continuing,
}: {
  answers?: Answers;
  minimum?: Urgency;
  contentVersion?: string;
  continuing?: boolean;
  showIncomplete?: boolean;
}) {
  const doc = contentFor(contentVersion);
  const floor = evaluate(answers, contentVersion);
  const urgency =
    minimum &&
    doc.urgencies.indexOf(minimum) > doc.urgencies.indexOf(floor.urgency)
      ? minimum
      : floor.urgency;
  if (!showIncomplete && urgency === "review" && !floor.matches.length)
    return null;
  return (
    <section
      role={urgency === "immediate" ? "alert" : "status"}
      aria-label={
        urgency === "review"
          ? "Clinical review advice"
          : "Important medical advice"
      }
      className={`urgency ${urgency}`}
    >
      <strong>
        {urgency !== "review" && "Important · "}
        {urgencyNames[urgency]}
      </strong>
      <p>{doc.advice[urgency]}</p>
      {continuing && urgency === "immediate" && doc.continuationAdvice && (
        <p>{doc.continuationAdvice}</p>
      )}
      {urgency !== floor.urgency && (
        <small>
          The preliminary AI assessment raised the urgency above the
          questionnaire minimum.
        </small>
      )}
      {floor.matches.length > 0 && (
        <details>
          <summary>Why this advice appears</summary>
          <ul>
            {floor.matches.map((r) => (
              <li key={r.id}>
                {r.reason}
                <ul>
                  {r.all.map((term) => {
                    const q = doc.questions.find((q) => q.id === term.field);
                    return q ? (
                      <li key={term.field}>
                        {q.label}{" "}
                        <strong>{answerText(q, answers[q.id])}</strong>
                      </li>
                    ) : null;
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
      {showIncomplete && floor.missing.length > 0 && (
        <small>
          {floor.missing.length} safety answers are missing or uncertain.
          {doc.incompleteAdvice && <> {doc.incompleteAdvice}</>}
        </small>
      )}
    </section>
  );
}
export { AiAssessment } from "./assessment";
export function EncounterMessages({
  encounter,
  patient = false,
  onChange,
}: {
  encounter: Encounter;
  patient?: boolean;
  onChange: (e: Encounter) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!encounter.consentAt) return null;
  return (
    <section className="panel stack">
      <h2>Clarifications with the care team</h2>
      <p>
        For this encounter only. Messages are not monitored for emergencies.
        Seek immediate assistance when needed. New answers or report findings
        must be added to the intake before another AI assessment.
      </p>
      {(encounter.messages ?? []).map((m) => (
        <article className="fact" key={m.id}>
          <strong>
            {m.author === "clinician" ? "Clinician" : "Patient / caregiver"}
          </strong>
          <small className="block">
            {new Date(m.createdAt).toLocaleString()}
          </small>
          <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
        </article>
      ))}
      {!encounter.messages?.length && (
        <small>No clarification messages yet.</small>
      )}
      {encounter.status !== "reviewed" && (patient || encounter.canReview) && (
        <>
          <label>
            {patient
              ? "Reply or ask for clarification"
              : "Request missing information"}
            <textarea
              maxLength={1500}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {!patient && (
            <button
              className="secondary"
              onClick={() =>
                setText(
                  "Please add any existing relevant report and confirm when your symptoms first started. You do not need to obtain new tests just to complete this intake.",
                )
              }
            >
              Use existing-report request
            </button>
          )}
          <button
            disabled={busy || !text.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                onChange(
                  await action("message", encounter.id, { text }, patient),
                );
                setText("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Send clarification"}
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export { ReportLibrary } from "./report-library";
export function ReleasedPlan({ encounter }: { encounter: Encounter }) {
  const plan = encounter.release;
  if (!plan) return null;
  return (
    <section className="panel released-plan">
      <p className="eyebrow">Clinician-reviewed plan</p>
      <h2>Your clinician’s assessment</h2>
      <p>{plan.impression}</p>
      <dl className="facts-grid">
        <div>
          <dt>Doctor type</dt>
          <dd>{plan.specialty}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>
            {plan.urgency === "review"
              ? "Follow your clinician’s plan"
              : urgencyNames[plan.urgency]}
          </dd>
        </div>
      </dl>
      <h3>What to do next</h3>
      <p className="preserve-lines">{plan.plan}</p>
      <div className="form-grid block">
        {plan.investigations?.length ? (
          <section className="panel">
            <h3>Tests to discuss</h3>
            <ul>
              {plan.investigations.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {plan.followUp && (
          <section className="panel">
            <h3>Follow-up</h3>
            <p>{plan.followUp}</p>
          </section>
        )}
      </div>
      {plan.urgencyReason && (
        <p>
          <strong>Why this priority: </strong>
          {plan.urgencyReason}
        </p>
      )}
      <small>
        {plan.author} · {new Date(encounter.releasedAt!).toLocaleString()} ·
        source version {plan.sourceVersion}.
      </small>
      <p>
        <button className="secondary" onClick={() => window.print()}>
          Print / save this plan
        </button>
      </p>
    </section>
  );
}
