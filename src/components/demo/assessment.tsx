"use client";
import { AnswerSummary } from "./question-input";
import { useRef, useState } from "react";
import type { Encounter } from "@/lib/demo/types";
import { contentFor, activeAnswers, type Intake } from "@/lib/demo/clinical";
import { Icon } from "@/components/ui";
import { ReportLibrary, UrgencyBanner } from "./shared";
import { printAssessment } from "./print-assessment";
import { isCurrentAssessment } from "@/lib/demo/assessment-state";
export function AiAssessment({
  encounter,
  patient = false,
}: {
  encounter: Encounter;
  patient?: boolean;
}) {
  const ai = isCurrentAssessment(encounter.ai) ? encounter.ai : null;
  const assessment = useRef<HTMLElement>(null);
  const content = contentFor(encounter.contentVersion);
  const intake = encounter.intake as Intake;
  const facts = ai?.sourceFacts ?? [];
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const pending = ["running", "queued"].includes(encounter.job?.status ?? "");
  const reportsPending = encounter.reports.some((r) =>
    ["queued", "running"].includes(r.extractionStatus ?? ""),
  );
  const possibility = ai?.possibilities[selected];
  return (
    <section ref={assessment} className="assessment-section">
      {!ai ? (
        <div className="state-screen">
          <div className="notice">
            <div className="feature-row">
              <span className="icon-circle amber">
                <Icon name={pending ? "clock" : "document"} size={28} />
              </span>
              <div>
                <h2>
                  {reportsPending
                    ? "Your reports are being processed"
                    : encounter.aiOutdated
                      ? "AI assessment needs an update"
                      : pending
                        ? "Your AI assessment is being prepared"
                        : "AI assessment unavailable"}
                </h2>
                <p>
                  {reportsPending
                    ? "Your answers are saved. Extracted report findings will be included automatically when processing finishes. You can continue with clinical review."
                    : encounter.aiOutdated
                      ? "An earlier AI assessment is stored for this visit. Ask the clinician to refresh it using the current information."
                      : pending
                        ? "Your answers are saved. This page updates automatically when the analysis is ready."
                        : "We could not prepare a preliminary assessment for this visit."}
                </p>
              </div>
            </div>
          </div>
          <div className="panel">
            <h2>Your next step</h2>
            <p>
              Ask clinic staff to arrange clinical review. A clinician can
              review your answers and available reports while the AI assessment
              is {pending ? "in progress" : "unavailable"}.
            </p>
          </div>
          <UrgencyBanner
            contentVersion={encounter.contentVersion}
            answers={intake.answers}
          />
          <div className="panel">
            <h2>Your information</h2>
            <ul className="state-timeline">
              <li>
                <Icon name="check" /> Intake answers saved
              </li>
              <li>
                <Icon name="check" /> Clinician review remains assigned
              </li>
            </ul>
            <details>
              <summary>View my answers</summary>
              <AnswerSummary
                questions={content.questions}
                answers={intake.answers ?? {}}
                active={activeAnswers(intake.answers ?? {}, content.version)}
              />
            </details>
          </div>
          <div className="info-note">
            <Icon name="alert" />
            <span>
              Show this screen to clinic staff. Do not wait for AI if you need
              medical help.
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="assessment-layout">
            <div className="assessment-main">
              <div className="notice">
                <strong>AI-generated · Not yet reviewed by a clinician</strong>
                <p>
                  This is a preliminary assessment, not a confirmed diagnosis.
                  An examination and further information may change it.
                </p>
              </div>
              <section className="panel assessment-summary">
                <p className="eyebrow">Your symptoms and reports, explained</p>
                <h2>Your preliminary AI assessment</h2>
                <button
                  className="secondary"
                  onClick={() => printAssessment(assessment.current)}
                >
                  Save or print assessment
                </button>
                <p className="lead">{ai.summary}</p>
                <p className="eyebrow block">Sources considered</p>
                <div className="source-chips">
                  <span className="source-chip">
                    <Icon name="document" size={16} /> Your answers · v
                    {ai.sourceVersion ?? encounter.version}
                  </span>
                  {Array.from(
                    new Set(
                      facts.flatMap((f) => (f.reportId ? [f.reportId] : [])),
                    ),
                  ).map((reportId) => (
                    <button
                      className="source-chip"
                      key={reportId}
                      onClick={() => setSourcesOpen(!sourcesOpen)}
                    >
                      <Icon name="document" size={16} />
                      {facts.find((f) => f.reportId === reportId)?.reportName} ·
                      Report findings
                    </button>
                  ))}
                </div>
                {facts.some((f) => f.verification === "machine-extracted") && (
                  <p className="muted">
                    This assessment uses automatically extracted report findings
                    that have not been reviewed by staff. The clinician can
                    check and correct them against the originals.
                  </p>
                )}
                <h3>Possible explanations to discuss</h3>
                <div className="hypotheses">
                  {ai.possibilities.map((p, i) => (
                    <button
                      className="hypothesis-open"
                      key={p.name}
                      onClick={() => {
                        setSelected(i);
                        dialog.current?.showModal();
                      }}
                    >
                      <span>
                        {p.name}
                        <small>{p.reason}</small>
                        <span className="link-button">
                          See evidence and uncertainty
                        </span>
                      </span>
                      <Icon name="arrow" />
                    </button>
                  ))}
                </div>
              </section>
              <section className="panel">
                <h3>What is still uncertain</h3>
                <ul>
                  {ai.missingInformation.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <details>
                  <summary>Regional conditions considered</summary>
                  <p>
                    <strong>{ai.regionalConsideration.condition}: </strong>
                    {ai.regionalConsideration.comment}
                  </p>
                </details>
              </section>
            </div>
            <aside className="assessment-next">
              <section className="panel specialty-card">
                <p className="eyebrow">Your next steps</p>
                <h2>Who to see next</h2>
                <div className="feature-row">
                  <span className="icon-circle">
                    <Icon name="person" size={30} />
                  </span>
                  <div>
                    <h3>{ai.specialty}</h3>
                    <p>
                      {ai.specialtyReason ||
                        content.specialtyDescriptions?.[ai.specialty]}
                    </p>
                  </div>
                </div>
                <h3 className="block">How urgent is this?</h3>
                <UrgencyBanner
                  contentVersion={encounter.contentVersion}
                  answers={intake.answers}
                  minimum={ai.urgency}
                />
                <h3 className="block">What to discuss with your clinician</h3>
                <ol className="next-steps">
                  {ai.nextSteps.map((t, i) => (
                    <li key={i}>
                      {typeof t === "string" ? (
                        t
                      ) : (
                        <span>
                          <strong>{t.name}</strong>
                          <small className="block">{t.why}</small>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="info-note">
                  <Icon name="alert" size={18} />
                  Your clinician decides which investigations you need.
                </p>
                <small className="block">
                  {new Date(encounter.aiCreatedAt!).toLocaleString()} · Source v
                  {ai.sourceVersion ?? encounter.version}
                  <br />
                  AI model: {ai.model || "Configured model"}
                </small>
              </section>
            </aside>
          </div>
          <dialog
            ref={dialog}
            className="evidence-dialog"
            aria-labelledby="evidence-title"
          >
            <div className="dialog-toolbar">
              <button
                className="link-button"
                onClick={() => dialog.current?.close()}
              >
                ← All possible causes
              </button>
              <button
                className="secondary icon-button"
                aria-label="Close evidence"
                onClick={() => dialog.current?.close()}
              >
                ×
              </button>
            </div>
            {possibility && (
              <>
                <h2 id="evidence-title">{possibility.name}</h2>
                <p className="notice">
                  AI-generated · Unreviewed · Not a confirmed diagnosis
                </p>
                <h3>Why this is being considered</h3>
                <p>{possibility.reason}</p>
                <h3>Your evidence</h3>
                {possibility.evidenceIds.map((id) => {
                  const f = facts.find((f) => f.id === id);
                  return (
                    <div className="fact" key={id}>
                      <strong>{f?.label ?? "Source finding"}</strong>
                      <p>{f?.value ?? "Source unavailable"}</p>
                      <span className="source-chip">
                        {f?.source ?? "Inspect the original evidence"}
                      </span>
                    </div>
                  );
                })}
                <h3 className="block">What is missing or could change this</h3>
                <p>{possibility.uncertainty}</p>
                <h3>Other explanations still need review</h3>
                <p>
                  {ai.possibilities
                    .filter((_, i) => i !== selected)
                    .map((p) => p.name)
                    .join(" · ") ||
                    "Your clinician may consider other explanations after examination."}
                </p>
                {encounter.reports.length > 0 && (
                  <button
                    className="secondary"
                    onClick={() => {
                      dialog.current?.close();
                      setSourcesOpen(true);
                    }}
                  >
                    View original report sources
                  </button>
                )}
                <p className="info-note block">
                  Discuss these findings and next steps with {ai.specialty}.
                </p>
                <button onClick={() => dialog.current?.close()}>
                  Back to my assessment
                </button>
              </>
            )}
          </dialog>
        </>
      )}
      {sourcesOpen && (
        <section className="panel block screen-only">
          <ReportLibrary encounter={encounter} patient={patient} />
        </section>
      )}
    </section>
  );
}
