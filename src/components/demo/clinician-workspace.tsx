"use client";
import { AnswerSummary } from "./question-input";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, StepRail } from "@/components/ui";
import {
  contentFor,
  activeAnswers,
  evaluate,
  urgencyNames,
  reviewSchema,
  type Intake,
  type Review,
} from "@/lib/demo/clinical";
import type { Encounter } from "@/lib/demo/types";
import {
  action,
  AiAssessment,
  ReportLibrary,
  ReleasedPlan,
  UrgencyBanner,
  EncounterMessages,
  notifyPatientReset,
} from "./shared";
import { AIFeedback } from "./ai-feedback";
import {
  blankReview,
  reviewForEditing,
  reviewFieldErrors,
} from "@/lib/demo/review-form";
export function ClinicianWorkspace({ id }: { id: string }) {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [review, setReview] = useState<Review>(blankReview);
  const [tab, setTab] = useState("assessment");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const edits = useRef(0);
  const [reviewSourceVersion, setReviewSourceVersion] = useState<number | null>(
    null,
  );
  const draftChain = useRef(Promise.resolve());
  const load = useCallback(
    async (initial = false) => {
      try {
        const e = await action("get", id);
        contentFor(e.contentVersion);
        setEncounter(e);
        if (initial && e.independent)
          setReview(reviewForEditing(e.independent));
        if (initial && !e.independent && "answers" in e.intake)
          setReview((r) => ({
            ...r,
            urgency: evaluate((e.intake as Intake).answers, e.contentVersion)
              .urgency,
          }));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id],
  );
  useEffect(() => {
    void action("get", id)
      .then((e) => {
        contentFor(e.contentVersion);
        setEncounter(e);
        setReviewSourceVersion(
          e.draft && !e.finalReview && !e.independent
            ? (e.draftSourceVersion ?? e.version)
            : e.version,
        );
        if (e.finalReview || e.draft || e.independent)
          setReview(
            reviewForEditing(
              e.finalReview ||
                (e.draft && (e.draftSourceVersion ?? e.version) === e.version
                  ? e.draft
                  : null) ||
                e.independent ||
                e.draft,
            ),
          );
        else if ("answers" in e.intake)
          setReview((r) => ({
            ...r,
            urgency: evaluate((e.intake as Intake).answers, e.contentVersion)
              .urgency,
          }));
      })
      .catch((e) => setError(e.message));
    const timer = setInterval(() => void load(), 7000);
    return () => clearInterval(timer);
  }, [id, load]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    if (
      !dirty ||
      !encounter?.canReview ||
      encounter.status === "reviewed" ||
      reviewSourceVersion !== encounter.version
    )
      return;
    const editVersion = edits.current;
    const timer = setTimeout(() => {
      draftChain.current = draftChain.current
        .then(async () => {
          const saved = await action("draft", id, {
            review,
            sourceVersion: reviewSourceVersion,
          });
          if (edits.current === editVersion) {
            setDirty(false);
            setSavedAt(saved.draftAt ?? "");
          }
        })
        .catch(() =>
          setError("Draft could not be saved. Keep this page open and retry."),
        );
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    dirty,
    review,
    id,
    reviewSourceVersion,
    encounter?.canReview,
    encounter?.status,
    encounter?.version,
  ]);
  function update(patch: Partial<Review>) {
    edits.current++;
    setReview((r) => ({ ...r, ...patch }));
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !(key in patch)),
      ),
    );
    setDirty(true);
  }
  async function perform(name: string, payload: unknown = {}) {
    if (["independent", "release"].includes(name)) {
      const validation = reviewSchema.safeParse(review);
      if (!validation.success) {
        const fields = reviewFieldErrors(validation.error.issues);
        setFieldErrors(fields);
        setError(
          "Check the highlighted assessment fields. Your entries are still here.",
        );
        document.getElementById(`review-${Object.keys(fields)[0]}`)?.focus();
        return null;
      }
      payload = { ...(payload as object), review: validation.data };
    }
    setBusy(true);
    setError("");
    try {
      await draftChain.current;
      const body = ["independent", "release"].includes(name)
        ? { ...(payload as object), sourceVersion: reviewSourceVersion }
        : payload;
      const e = await action(name, id, body);
      contentFor(e.contentVersion);
      setEncounter(e);
      setFieldErrors({});
      if (["draft", "independent", "release"].includes(name)) setDirty(false);
      return e;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function handoff() {
    setBusy(true);
    try {
      const data = await action<{ next: string }>("handoff", id);
      notifyPatientReset();
      window.location.replace(data.next);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!encounter)
    return (
      <main id="main" className="clinic-page">
        <Link href="/staff">← Review queue</Link>
        <section className="panel">
          <h1>Encounter workspace</h1>
          <p>{error || "Opening encounter…"}</p>
        </section>
      </main>
    );
  const intake = encounter.intake as Intake;
  const content = contentFor(encounter.contentVersion);
  const floor = evaluate(intake.answers ?? {}, encounter.contentVersion);
  const saved = !!encounter.independentAt;
  const ai = encounter.ai;
  return (
    <main id="main" className="demo-container">
      <header className="demo-header">
        <span className="eyebrow">Clinical workspace</span>
        <Link href="/staff">← Review queue</Link>
        <span className="badge">{encounter.status.replaceAll("_", " ")}</span>
      </header>
      <div className="page-heading">
        <p className="eyebrow">
          Visit · {encounter.id.slice(0, 8).toUpperCase()}
        </p>
        <h1>{intake.name || "New patient intake"}</h1>
        <p>
          {intake.age ? `${intake.age} years · ${intake.sex} · ` : ""}
          {intake.suppliedBy === "caregiver"
            ? "Caregiver-reported"
            : intake.suppliedBy
              ? "Patient-reported"
              : "Awaiting consent"}
          {intake.enteredBy ? ` · ${intake.enteredBy}-entered` : ""}
        </p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {reviewSourceVersion !== encounter.version && (
        <section className="notice" role="alert">
          <p>
            The source information changed. Your entries are still here, but
            refer to an older version. Review the latest answers and report
            findings before saving an assessment.
          </p>
          <button
            className="secondary"
            disabled={
              busy || !encounter.canReview || encounter.status === "reviewed"
            }
            onClick={() => {
              setReviewSourceVersion(encounter.version);
              update({
                urgency:
                  content.urgencies.indexOf(review.urgency) <
                  content.urgencies.indexOf(floor.urgency)
                    ? floor.urgency
                    : review.urgency,
              });
              setError("");
            }}
          >
            I have reviewed the updated facts
          </button>
        </section>
      )}
      {encounter.aiOutdated && encounter.canReview && !encounter.releasedAt && (
        <section className="notice">
          <p>
            An earlier AI assessment is stored. Refreshing uses the current
            answers and report findings; your draft is retained for review
            against the updated version.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void perform("refresh_ai", { sourceVersion: encounter.version })
            }
          >
            Refresh preliminary AI assessment
          </button>
        </section>
      )}
      {encounter.status === "awaiting_consent" ||
      encounter.status === "intake" ? (
        <section className="panel">
          <h2>
            {encounter.status === "awaiting_consent"
              ? "Start the patient journey"
              : "Intake in progress"}
          </h2>
          <p>
            Hand this browser to the patient or coordinator. Starting the
            handoff ends the staff session on this device. Use a separate
            browser profile or tablet for the patient if you want the clinician
            workspace open at the same time.
          </p>
          <button disabled={busy} onClick={() => void handoff()}>
            Start / resume patient intake
          </button>
          {encounter.canReview &&
            encounter.consentAt &&
            "answers" in encounter.intake && (
              <>
                <UrgencyBanner
                  contentVersion={encounter.contentVersion}
                  answers={intake.answers}
                  minimum={encounter.aiUrgency}
                />
                <p>
                  The saved intake is incomplete. Taking it for review pauses
                  questionnaire editing; missing answers remain unknown. AI is
                  not generated for this partial review.
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void perform("review_partial")}
                >
                  Review saved incomplete intake
                </button>
              </>
            )}
          <p className="muted">
            The encounter is assigned for human review even if intake remains
            incomplete.
          </p>
          {intake.answers && (
            <UrgencyBanner
              contentVersion={encounter.contentVersion}
              answers={intake.answers}
              minimum={encounter.aiUrgency}
            />
          )}
        </section>
      ) : (
        <>
          <UrgencyBanner
            contentVersion={encounter.contentVersion}
            answers={intake.answers}
            minimum={encounter.aiUrgency}
          />
          <StepRail
            labels={["Review facts", "Your assessment", "AI feedback"]}
            current={tab === "comparison" ? 2 : saved ? 1 : 0}
          />
          <nav className="workspace-tabs" aria-label="Encounter views">
            <button
              className={tab === "assessment" ? "" : "secondary"}
              onClick={() => setTab("assessment")}
            >
              Your assessment
            </button>
            <button
              className={tab === "reports" ? "" : "secondary"}
              onClick={() => setTab("reports")}
            >
              Reports & evidence ({encounter.reports.length})
            </button>
            <button
              className={tab === "comparison" ? "" : "secondary"}
              disabled={!saved || !encounter.canReview}
              onClick={async () => {
                if (await perform("reveal")) setTab("comparison");
              }}
            >
              AI comparison {saved ? "" : "· locked"}
            </button>
            {encounter.release && (
              <button
                className={tab === "plan" ? "" : "secondary"}
                onClick={() => setTab("plan")}
              >
                Released plan
              </button>
            )}
          </nav>
          {tab === "reports" ? (
            <section className="panel">
              <ReportLibrary
                encounter={encounter}
                patient={false}
                onChange={setEncounter}
              />
            </section>
          ) : tab === "complete" ? (
            <section className="panel completion-screen">
              <span className="icon-circle">
                <Icon name="check" size={40} />
              </span>
              <h2>Assessment saved. Patient plan released.</h2>
              <p>
                Your assessment is now available in the patient’s visit. The
                preliminary AI assessment remains a separate record.
              </p>
              <div className="actions">
                <Link className="button" href="/staff">
                  Return to patient queue
                </Link>
                <button className="secondary" onClick={() => setTab("plan")}>
                  View released plan
                </button>
                <button
                  className="link-button"
                  onClick={async () => {
                    if (await perform("reveal")) setTab("comparison");
                  }}
                >
                  Give optional AI feedback
                </button>
              </div>
            </section>
          ) : tab === "plan" ? (
            <ReleasedPlan encounter={encounter} />
          ) : tab === "comparison" ? (
            <div className="stack">
              <header>
                <p className="eyebrow">Saved assessments compared</p>
                <h2>AI and clinician assessment</h2>
                <p>
                  {review.priorExposure === "not_exposed"
                    ? "Recorded as not previously exposed to AI."
                    : "Prior exposure reported; this case is not a blinded comparison."}{" "}
                  Agreement here is not a measure of clinical accuracy.
                </p>
              </header>
              <div className="comparison-grid">
                <section className="panel">
                  <h3>Your independent assessment</h3>
                  <p>{encounter.independent?.impression}</p>
                  <p>{encounter.independent?.specialty}</p>
                  <strong>
                    {urgencyNames[encounter.independent!.urgency]}
                  </strong>
                  <small className="block">
                    Saved {new Date(encounter.independentAt!).toLocaleString()}
                  </small>
                </section>
                <section className="panel">
                  <h3>AI assessment</h3>
                  {ai ? (
                    <>
                      <p>{ai.summary}</p>
                      <p>{ai.specialty}</p>
                      <strong>{urgencyNames[ai.urgency]}</strong>
                      <dl className="facts-grid">
                        <div>
                          <dt>Urgency agreement</dt>
                          <dd>
                            {encounter.independent?.urgency === ai.urgency
                              ? "Same category"
                              : "Different"}
                          </dd>
                        </div>
                        <div>
                          <dt>Specialty agreement</dt>
                          <dd>
                            {encounter.independent?.specialty === ai.specialty
                              ? "Same category"
                              : "Different"}
                          </dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p>
                      {encounter.job?.status === "running"
                        ? "AI is still analysing this encounter."
                        : "AI is not available for comparison yet."}
                    </p>
                  )}
                </section>
              </div>
              <AiAssessment encounter={encounter} />
              {encounter.job?.status === "failed" && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void perform("retry")}
                >
                  Retry AI analysis
                </button>
              )}
              <AIFeedback encounter={encounter} />
            </div>
          ) : (
            <div className="clinician-grid">
              <aside className="panel case-facts">
                <p className="eyebrow">
                  Source facts · version {encounter.version}
                </p>
                <h2>At a glance</h2>
                <p className="chief-complaint">
                  {intake.answers?.concern || "Chief concern not supplied"}
                </p>
                <div className="facts-grid">
                  <div>
                    <dt>Duration</dt>
                    <dd>{intake.answers?.duration || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Trend</dt>
                    <dd>{intake.answers?.pattern || "Unknown"}</dd>
                  </div>
                </div>
                <h3>Matched warning features</h3>
                {floor.matches.length ? (
                  <ul>
                    {floor.matches.map((r) => (
                      <li key={r.id}>{r.reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No warning rule matched the supplied answers. This does not
                    exclude serious disease.
                  </p>
                )}
                <h3>History and medicines</h3>
                {[
                  "medicines",
                  "allergies",
                  "conditions",
                  "surgery",
                  "family",
                  "previous_treatment",
                  "previous_tests",
                ].map((key) => (
                  <div className="fact" key={key}>
                    <strong>
                      {content.questions.find((q) => q.id === key)?.label}
                    </strong>
                    <p>
                      {intake.answers?.[key] || "Not answered"}
                      {intake.answers?.[key] &&
                        !activeAnswers(intake.answers, content.version)[
                          key
                        ] && (
                          <small className="block">
                            Earlier answer — does not apply to current
                            selections.
                          </small>
                        )}
                    </p>
                  </div>
                ))}
                <details>
                  <summary>All questionnaire answers</summary>
                  <AnswerSummary
                    questions={content.questions}
                    answers={intake.answers ?? {}}
                    active={activeAnswers(
                      intake.answers ?? {},
                      content.version,
                    )}
                  />
                </details>
                <h3>Reports</h3>
                <p>
                  {encounter.reports.length} original document(s) ·{" "}
                  {encounter.reports.reduce(
                    (n, r) => n + r.fields.filter((f) => f.verified).length,
                    0,
                  )}{" "}
                  verified finding(s)
                </p>
                <button className="secondary" onClick={() => setTab("reports")}>
                  Open report library
                </button>
              </aside>
              <section className="panel">
                <p className="eyebrow">
                  {saved
                    ? "Independent assessment saved"
                    : "Record your assessment before opening AI"}
                </p>
                <h2>
                  {saved
                    ? "Finalise the patient plan"
                    : "Your independent assessment"}
                </h2>
                {!encounter.canReview ? (
                  <p>
                    Clinical assessment and release require the clinician role.
                  </p>
                ) : (
                  <>
                    <label>
                      Clinical impression
                      <textarea
                        id="review-impression"
                        aria-invalid={!!fieldErrors.impression}
                        aria-describedby={
                          fieldErrors.impression
                            ? "review-impression-error"
                            : undefined
                        }
                        rows={4}
                        value={review.impression}
                        disabled={encounter.status === "reviewed"}
                        maxLength={2000}
                        onChange={(e) => update({ impression: e.target.value })}
                      />
                    </label>
                    {fieldErrors.impression && (
                      <p className="error" id="review-impression-error">
                        {fieldErrors.impression}
                      </p>
                    )}
                    <div className="form-grid">
                      <label>
                        Doctor type
                        <select
                          value={review.specialty}
                          disabled={encounter.status === "reviewed"}
                          onChange={(e) =>
                            update({
                              specialty: e.target.value as Review["specialty"],
                            })
                          }
                        >
                          {content.specialties.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Urgency
                        <select
                          value={review.urgency}
                          disabled={encounter.status === "reviewed"}
                          onChange={(e) =>
                            update({
                              urgency: e.target.value as Review["urgency"],
                            })
                          }
                        >
                          {content.urgencies.map((u) => (
                            <option
                              key={u}
                              value={u}
                              disabled={
                                content.urgencies.indexOf(u) <
                                content.urgencies.indexOf(floor.urgency)
                              }
                            >
                              {urgencyNames[u as keyof typeof urgencyNames]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <fieldset className="investigations">
                      <legend>Investigations to discuss</legend>
                      <div className="chip-options">
                        {(content.investigations ?? []).map((t) => (
                          <label
                            key={t}
                            className={
                              (review.investigations ?? []).includes(t)
                                ? "selected"
                                : ""
                            }
                          >
                            <input
                              type="checkbox"
                              disabled={encounter.status === "reviewed"}
                              checked={(review.investigations ?? []).includes(
                                t,
                              )}
                              onChange={(e) =>
                                update({
                                  investigations: e.target.checked
                                    ? [...(review.investigations ?? []), t]
                                    : (review.investigations ?? []).filter(
                                        (x) => x !== t,
                                      ),
                                })
                              }
                            />
                            {t}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label>
                      Reason for this priority
                      <textarea
                        rows={2}
                        maxLength={500}
                        disabled={encounter.status === "reviewed"}
                        value={review.urgencyReason ?? ""}
                        onChange={(e) =>
                          update({ urgencyReason: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Follow-up arrangements
                      <textarea
                        rows={2}
                        maxLength={1000}
                        disabled={encounter.status === "reviewed"}
                        value={review.followUp ?? ""}
                        onChange={(e) => update({ followUp: e.target.value })}
                      />
                    </label>
                    <label>
                      Instructions for the patient
                      <textarea
                        id="review-plan"
                        aria-invalid={!!fieldErrors.plan}
                        aria-describedby={
                          fieldErrors.plan ? "review-plan-error" : undefined
                        }
                        rows={5}
                        value={review.plan}
                        disabled={encounter.status === "reviewed"}
                        maxLength={3000}
                        onChange={(e) => update({ plan: e.target.value })}
                      />
                    </label>
                    {fieldErrors.plan && (
                      <p className="error" id="review-plan-error">
                        {fieldErrors.plan}
                      </p>
                    )}
                    {encounter.status !== "reviewed" && (
                      <div className="actions">
                        {[
                          "Bring existing reports and a list of current medicines.",
                          "The clinician will decide which investigations are needed after examination.",
                          "Seek immediate medical assistance if symptoms become severe or new warning signs appear.",
                        ].map((text) => (
                          <button
                            className="macro"
                            key={text}
                            onClick={() =>
                              update({
                                plan:
                                  review.plan +
                                  (review.plan ? "\n" : "") +
                                  text,
                              })
                            }
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    )}
                    <details>
                      <summary>Private clinician notes</summary>
                      <textarea
                        rows={3}
                        maxLength={3000}
                        value={review.privateNotes}
                        disabled={saved}
                        onChange={(e) =>
                          update({ privateNotes: e.target.value })
                        }
                      />
                      <small>
                        Saved with the independent assessment; excluded from
                        patient views.
                      </small>
                    </details>
                    <label>
                      Had you already seen or heard this AI assessment?
                      <select
                        value={review.priorExposure}
                        disabled={saved}
                        onChange={(e) =>
                          update({
                            priorExposure: e.target
                              .value as Review["priorExposure"],
                          })
                        }
                      >
                        <option value="not_exposed">No prior exposure</option>
                        <option value="patient_disclosed">
                          Patient / caregiver mentioned it
                        </option>
                        <option value="previously_seen">
                          I had already seen it
                        </option>
                      </select>
                    </label>
                    {encounter.status !== "reviewed" && (
                      <div className="flow-footer inline-footer">
                        <button
                          className="secondary"
                          disabled={
                            busy || reviewSourceVersion !== encounter.version
                          }
                          onClick={() =>
                            void perform("draft", {
                              review,
                              sourceVersion: reviewSourceVersion,
                            })
                          }
                        >
                          Save draft
                        </button>
                        {!saved ? (
                          <button
                            disabled={
                              busy || reviewSourceVersion !== encounter.version
                            }
                            onClick={() =>
                              void perform("independent", { review })
                            }
                          >
                            Save independent assessment
                          </button>
                        ) : (
                          <>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={async () => {
                                if (await perform("reveal"))
                                  setTab("comparison");
                              }}
                            >
                              Compare with AI
                            </button>
                            <button
                              disabled={
                                busy ||
                                reviewSourceVersion !== encounter.version
                              }
                              onClick={async () => {
                                if (await perform("release", { review }))
                                  setTab("complete");
                              }}
                            >
                              Release clinician’s patient plan
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {saved && (
                      <p className="notice" role="status">
                        Independent assessment saved. You can now compare it
                        with AI and prepare the patient plan.
                      </p>
                    )}
                    {error && (
                      <p className="error" role="alert">
                        {error}
                      </p>
                    )}
                    <small className="block">
                      {dirty
                        ? "Unsaved changes — save before leaving."
                        : saved
                          ? "Independent assessment saved and preserved."
                          : savedAt
                            ? `Draft autosaved at ${new Date(savedAt).toLocaleTimeString()}. AI remains hidden.`
                            : "AI remains hidden until your independent assessment is saved."}
                    </small>
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}
      <EncounterMessages encounter={encounter} onChange={setEncounter} />
      <footer className="demo-footer">GI Compass · Clinical workspace</footer>
    </main>
  );
}
