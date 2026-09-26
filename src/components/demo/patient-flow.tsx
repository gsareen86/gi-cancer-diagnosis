"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  content,
  contentFor,
  activeAnswers,
  intakeSchemaFor,
  patchIntake,
  visibleQuestions,
  type Intake,
} from "@/lib/demo/clinical";
import { blankIntake } from "@/lib/demo/fixtures";
import { currentNoticeVersion } from "@/lib/demo/consent";
import type { Encounter } from "@/lib/demo/types";
import { Brand, Icon, StepRail } from "@/components/ui";
import { PausedIntake } from "./patient-states";
import { QuestionInput, AnswerSummary } from "./question-input";
import { isActive } from "@/lib/demo/questionnaire";
import {
  flowFor,
  currentTopic,
  type IntakeNavigation,
} from "@/lib/demo/intake-flow";
import {
  TopicQuestions,
  OptionalTopics,
  TopicAnswerReview,
} from "./intake-topics";
import {
  action,
  AiAssessment,
  ReportLibrary,
  ReleasedPlan,
  UrgencyBanner,
  EncounterMessages,
  notifyPatientReset,
} from "./shared";
const stages = [
  "Consent",
  "About you",
  "Safety check",
  "Symptoms",
  "History",
  "Reports",
  "Review",
];
export function PatientFlow() {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [intake, setIntake] = useState<Intake>(blankIntake);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const contentVersion = useRef(content.version);
  const questionHeading = useRef<HTMLLegendElement>(null);
  useEffect(() => {
    questionHeading.current?.focus();
  }, [questionIndex, step]);
  const revision = useRef(0);
  const encounterId = useRef<string | null>(null);
  const serial = useRef(Promise.resolve());
  const changed = useRef(false);
  const editNumber = useRef(0);
  useEffect(() => {
    const channel = new BroadcastChannel("gi-compass-patient-session");
    channel.onmessage = () => {
      changed.current = false;
      setEncounter(null);
      setIntake(blankIntake);
      setError(
        "This tablet session ended. Start a new visit when you are ready.",
      );
    };
    return () => channel.close();
  }, []);
  const refresh = useCallback(async () => {
    try {
      const e = await action("get", encounterId.current, {}, true);
      contentFor(e.contentVersion);
      setEncounter(e);
      revision.current = e.version;
      return e;
    } catch (e) {
      setEncounter(null);
      setIntake(blankIntake);
      changed.current = false;
      setError((e as Error).message);
      return null;
    }
  }, []);
  useEffect(() => {
    void action("get", null, {}, true)
      .then((e) => {
        contentFor(e.contentVersion);
        contentVersion.current = e.contentVersion;
        setEncounter(e);
        encounterId.current = e.id;
        revision.current = e.version;
        if (e.consentAt) {
          const i = "answers" in e.intake ? (e.intake as Intake) : blankIntake;
          const layout = flowFor(e.contentVersion);
          const topic = currentTopic(
            e.contentVersion,
            i.answers,
            i.stage,
            i.navigation,
          );
          if (layout && topic && !i.navigation)
            i.navigation = {
              flowVersion: layout.version,
              topicId: topic.id,
              mode: "main",
            };
          setIntake(i);
          setStep(Math.max(1, i.stage));
        }
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      void action("get", encounterId.current, {}, true).catch(() => {
        setEncounter(null);
        setIntake(blankIntake);
        changed.current = false;
        setError(
          "This encounter session has ended. Ask staff for a new handoff.",
        );
      });
    }, 30000);
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", show);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pageshow", show);
    };
  }, []);
  const status = encounter?.status;
  useEffect(() => {
    if (!status || ["intake", "awaiting_consent"].includes(status)) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [status, refresh]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (changed.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  const save = useCallback((value: Intake) => {
    const savingEdit = editNumber.current;
    const next = serial.current.then(async () => {
      const valid = intakeSchemaFor(contentVersion.current).safeParse(value);
      if (!valid.success)
        throw new Error(
          "Please complete the name, adult age and details before saving.",
        );
      setSaveState("Saving…");
      const e = await action(
        "save",
        encounterId.current,
        { intake: value, version: revision.current },
        true,
      );
      revision.current = e.version;
      setEncounter(e);
      if (editNumber.current === savingEdit) {
        changed.current = false;
        setSaveState("Saved securely");
      }
    });
    serial.current = next.catch(() => {});
    return next;
  }, []);
  useEffect(() => {
    if (
      !changed.current ||
      !encounter?.consentAt ||
      encounter.status !== "intake" ||
      !intakeSchemaFor(contentVersion.current).safeParse(intake).success
    )
      return;
    const timer = setTimeout(() => {
      void save(intake).catch((e) => {
        setSaveState("Not saved");
        setError(e.message);
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [intake, encounter?.consentAt, encounter?.status, save]);
  function update(patch: Partial<Intake>) {
    editNumber.current++;
    changed.current = true;
    setSaveState("Unsaved changes");
    setIntake((i) => patchIntake(i, patch));
  }
  async function move(target: number, navigation?: IntakeNavigation) {
    setBusy(true);
    setError("");
    try {
      const value = { ...intake, stage: target };
      const layout = flowFor(contentVersion.current);
      if (navigation) value.navigation = navigation;
      else if (layout && target >= 2 && target <= 4) {
        const topic = currentTopic(
          contentVersion.current,
          intake.answers,
          target,
          { ...intake.navigation!, flowVersion: layout.version, mode: "main" },
        );
        if (topic)
          value.navigation = {
            flowVersion: layout.version,
            topicId: topic.id,
            mode: "main",
          };
      }
      await save(value);
      setIntake(value);
      setStep(target);
      setQuestionIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function consent() {
    setBusy(true);
    try {
      const e = await action(
        "consent",
        encounterId.current,
        { accepted: true, noticeVersion: currentNoticeVersion },
        true,
      );
      setEncounter(e);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await save({ ...intake, stage: 6 });
      setEncounter(await action("submit", encounterId.current, {}, true));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function end(withdraw = false) {
    setBusy(true);
    try {
      if (changed.current && !withdraw) await save(intake);
      await action(
        withdraw ? "withdraw" : "reset",
        encounterId.current,
        {},
        true,
      );
      changed.current = false;
      notifyPatientReset();
      window.location.replace("/patient/ended");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const section = step === 2 ? "safety" : step === 3 ? "symptoms" : "history";
  const questionnaire = contentFor(
    encounter?.contentVersion ?? content.version,
  );
  const questions = visibleQuestions(
    section,
    intake.answers,
    questionnaire.version,
  );
  const questionStep = step >= 2 && step <= 4;
  const layout = flowFor(questionnaire.version);
  const topic = questionStep
    ? currentTopic(
        questionnaire.version,
        intake.answers,
        step,
        intake.navigation,
      )
    : undefined;
  const guidedQuestion = !!topic;
  const currentQuestion = Math.min(
    questionIndex,
    Math.max(0, questions.length - 1),
  );
  async function navigateQuestion(direction: number) {
    if (
      questionStep &&
      currentQuestion + direction >= 0 &&
      currentQuestion + direction < questions.length
    ) {
      setBusy(true);
      setError("");
      try {
        await save(intake);
        setQuestionIndex(currentQuestion + direction);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    } else await move(step + direction);
  }
  const majorStep = step <= 1 ? step : step <= 4 ? 2 : step - 2;
  const submitted =
    encounter && !["intake", "awaiting_consent"].includes(encounter.status);
  return (
    <main id="main" className="demo-container patient-main">
      <header className="demo-header">
        <Link href="/" className="brand">
          <Brand />
        </Link>
        <span className="header-context">
          Your visit ·{" "}
          {encounter?.id.slice(0, 8).toUpperCase() ?? "Patient intake"}
        </span>
        <button
          className="secondary"
          disabled={busy || !encounter}
          onClick={() => void end()}
        >
          End this tablet session
        </button>
      </header>
      {!encounter ? (
        <section className="panel">
          <h1>Patient intake</h1>
          <p>{error || "Opening your encounter…"}</p>
          {error && <Link href="/start">Start a new visit</Link>}
          <p className="notice">
            If you feel seriously unwell, seek immediate medical assistance or
            visit a hospital. Do not wait for this app.
          </p>
        </section>
      ) : submitted ? (
        <>
          <UrgencyBanner
            answers={intake.answers}
            contentVersion={questionnaire.version}
            minimum={encounter.ai?.urgency}
          />
          <div className="page-heading">
            <p className="eyebrow">Your answers are saved</p>
            <h1>
              {encounter.release
                ? "Your care plan"
                : "Your preliminary assessment"}
            </h1>
            <p>
              {encounter.release
                ? "Your clinician's plan is shown separately from the preliminary AI assessment."
                : "Understand your symptoms, explore the evidence, and see the next steps in your care."}
            </p>
          </div>
          <ReleasedPlan encounter={encounter} />
          <AiAssessment encounter={encounter} patient />
          <EncounterMessages
            encounter={encounter}
            patient
            onChange={setEncounter}
          />
          {encounter.status !== "reviewed" && (
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                try {
                  const e = await action(
                    "reopen",
                    encounterId.current,
                    {},
                    true,
                  );
                  revision.current = e.version;
                  setEncounter(e);
                  setStep(6);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Correct or add information
            </button>
          )}
          <p>
            <button
              className="link-button"
              onClick={() => {
                if (
                  window.confirm(
                    "Withdraw permission for further AI processing? Your already recorded encounter stays available for staff follow-up.",
                  )
                )
                  void end(true);
              }}
            >
              Withdraw consent and end session
            </button>
          </p>
        </>
      ) : paused ? (
        <>
          <UrgencyBanner
            answers={intake.answers}
            contentVersion={questionnaire.version}
            continuing
            showIncomplete
          />
          <PausedIntake
            intake={intake}
            contentVersion={questionnaire.version}
            busy={busy}
            onContinue={() => setPaused(false)}
            onEnd={() => void end()}
          />
        </>
      ) : (
        <>
          <StepRail
            labels={[
              "Consent",
              "About you",
              "Main questions",
              "Reports",
              "Review",
            ]}
            current={majorStep}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {step > 0 && (
            <UrgencyBanner
              answers={intake.answers}
              contentVersion={questionnaire.version}
              continuing
              showIncomplete={step === 6}
            />
          )}
          {questionnaire.version !== content.version && step > 0 && (
            <p className="notice">
              This visit uses an earlier questionnaire. Its saved answers and
              rules are preserved. Newly started visits use the revised
              questions.
            </p>
          )}
          {step > 0 && (
            <div className="page-heading">
              <p className="eyebrow">
                {stages[step]} · {saveState || "Your visit"}
              </p>
              <h1>
                {
                  [
                    "",
                    "Tell us a little about yourself.",
                    "A few important checks first.",
                    "Let’s understand your symptoms.",
                    "Your health, in context.",
                    "Add your existing reports.",
                    "Review your information.",
                  ][step]
                }
              </h1>
              {step === 1 && (
                <p>This helps your care team understand your answers.</p>
              )}
            </div>
          )}
          {step === 0 ? (
            <div className="demo-split">
              <section className="panel consent-intro">
                <p className="eyebrow">Before we begin</p>
                <h1>
                  Your information.
                  <br />
                  Your choice.
                </h1>
                <p className="lead">
                  Share your symptoms and history to help your care team
                  understand your visit.
                </p>
                <div className="feature-row">
                  <span className="icon-circle">
                    <Icon name="document" size={30} />
                  </span>
                  <div>
                    <h3>Tell your story once</h3>
                    <p>
                      Answer a few questions about your symptoms and medical
                      history. Add existing reports if you have them.
                    </p>
                  </div>
                </div>
                <div className="feature-row">
                  <span className="icon-circle">
                    <Icon name="spark" size={30} />
                  </span>
                  <div>
                    <h3>Understand your preliminary AI assessment</h3>
                    <p>
                      Explore possible explanations, the facts behind them, and
                      what remains uncertain.
                    </p>
                  </div>
                </div>
                <div className="feature-row">
                  <span className="icon-circle">
                    <Icon name="person" size={30} />
                  </span>
                  <div>
                    <h3>A clinician records a separate assessment</h3>
                    <p>
                      Your visit stays assigned for human review. AI does not
                      replace your clinician.
                    </p>
                  </div>
                </div>
              </section>
              <section className="panel consent-form">
                <p className="eyebrow">Your consent</p>
                <h2>Before you continue</h2>
                <p>
                  Please read how your information is used and confirm your
                  choice for this visit.
                </p>
                <p>
                  Your answers and optional reports are used to prepare a
                  preliminary AI assessment and support your clinician’s review.
                </p>
                {encounter.synthetic && (
                  <p className="notice">
                    <strong>Demonstration — fictional information only.</strong>{" "}
                    Use the supplied sample reports. This demonstration may send
                    information to an external AI provider; India-only AI
                    processing is not established for this demo.
                  </p>
                )}
                <p>
                  AI can be wrong. Its possible explanations are not a
                  diagnosis, cannot rule out serious illness and do not replace
                  a medical examination.
                </p>
                <details className="privacy-notice">
                  <summary>Read the full visit notice</summary>
                  <p>
                    Your information is stored for this encounter and accessed
                    by the assigned care team. Written report findings are
                    extracted automatically and used in the preliminary AI
                    assessment. Staff can review and correct them against the
                    original. Extraction and AI output may be incorrect.
                  </p>
                  <p>
                    You can leave before consenting without storing clinical
                    answers. After consent, saved answers remain available for
                    care-team review if you pause. You can withdraw further AI
                    processing from your assessment screen. Ending the device
                    session clears access on this device; it does not erase the
                    encounter.
                  </p>
                  <p>
                    Ask clinic staff about the organisation responsible for your
                    information, retention, and privacy requests before
                    proceeding. Clinical wording is awaiting approval.
                  </p>
                </details>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  I agree to the use of my information for this visit, report
                  processing and a preliminary AI assessment.
                </label>
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void end()}
                  >
                    I do not agree
                  </button>
                  <button
                    disabled={!accepted || busy}
                    onClick={() => void consent()}
                  >
                    Agree and continue
                  </button>
                </div>
                <small className="block">
                  No clinical answers are saved before consent.
                </small>
              </section>
            </div>
          ) : step === 1 ? (
            <div className="demo-split">
              <section className="panel">
                <h2>About you</h2>
                <label>
                  Name
                  <input
                    value={intake.name}
                    maxLength={80}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Age in years
                    <input
                      type="number"
                      min="18"
                      max="110"
                      value={intake.age || ""}
                      onChange={(e) => update({ age: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Sex
                    <select
                      value={intake.sex}
                      onChange={(e) =>
                        update({ sex: e.target.value as Intake["sex"] })
                      }
                    >
                      {[
                        "Female",
                        "Male",
                        "Intersex",
                        "Other",
                        "Prefer not to answer",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Who is giving the answers?
                  <select
                    value={intake.suppliedBy}
                    onChange={(e) =>
                      update({
                        suppliedBy: e.target.value as Intake["suppliedBy"],
                      })
                    }
                  >
                    <option value="patient">Patient</option>
                    <option value="caregiver">Family member / caregiver</option>
                  </select>
                </label>
                {intake.suppliedBy === "caregiver" && (
                  <label>
                    Relationship to the patient
                    <input
                      value={intake.relationship}
                      onChange={(e) => update({ relationship: e.target.value })}
                    />
                  </label>
                )}
                <label>
                  Who is entering the answers?
                  <select
                    value={intake.enteredBy}
                    onChange={(e) =>
                      update({
                        enteredBy: e.target.value as Intake["enteredBy"],
                      })
                    }
                  >
                    <option value="patient">Patient / family member</option>
                    <option value="coordinator">Clinic coordinator</option>
                  </select>
                </label>
              </section>
              <aside className="panel soft-panel">
                <p className="eyebrow">Answering together</p>
                <h2>Your answers, your pace</h2>
                {layout && <p>{layout.intro}</p>}
                <p>
                  You can answer on your own or with help from a family member
                  or clinic coordinator.
                </p>
                <div className="info-note">
                  <Icon name="person" />
                  <span>
                    Tell us who provides the answers and who enters them.
                  </span>
                </div>
              </aside>
            </div>
          ) : guidedQuestion ? (
            <TopicQuestions
              topic={topic!}
              version={questionnaire.version}
              answers={intake.answers}
              mode={intake.navigation?.mode ?? "main"}
              busy={busy}
              assisted={
                intake.suppliedBy === "caregiver" ||
                intake.enteredBy === "coordinator"
              }
              onChange={(id, value) =>
                update({ answers: { ...intake.answers, [id]: value } })
              }
              onNavigate={(target, nav) => void move(target, nav)}
            />
          ) : step >= 2 && step <= 4 ? (
            <div className="question-layout">
              <section className="panel">
                <h2 className="sr-only">
                  {step === 2
                    ? "Check for symptoms needing immediate help"
                    : step === 3
                      ? "Tell the patient’s symptom story"
                      : "History and care so far"}
                </h2>
                <div className="question-counter">
                  <span>{stages[step]}</span>
                  <span>
                    Question {currentQuestion + 1} of {questions.length}
                  </span>
                </div>
                {(intake.suppliedBy === "caregiver" ||
                  intake.enteredBy === "coordinator") &&
                  questionnaire.assistedAdvice && (
                    <p className="question-help">
                      {questionnaire.assistedAdvice}
                    </p>
                  )}
                {questions
                  .slice(currentQuestion, currentQuestion + 1)
                  .map((q) => (
                    <fieldset key={q.id} className="question-card">
                      <legend tabIndex={-1} ref={questionHeading}>
                        {q.label}
                      </legend>
                      <QuestionInput
                        question={q}
                        answers={intake.answers}
                        legacy={questionnaire.version !== content.version}
                        onChange={(id, value) =>
                          update({
                            answers: { ...intake.answers, [id]: value },
                          })
                        }
                      />
                    </fieldset>
                  ))}
              </section>
              <aside className="panel answer-guide">
                <p className="eyebrow">Answer guide</p>
                <h2>Describe what has changed</h2>
                <div className="guide-visual">
                  <span className="icon-circle">
                    <Icon name="document" size={44} />
                  </span>
                </div>
                <p>
                  {step === 2
                    ? "We ask about symptoms now and in the past. Follow-up questions depend on your answers; you can add details in your own words."
                    : step === 3
                      ? "Use your own words. Include when symptoms started, whether they are worsening, and what makes them better or worse."
                      : "Include over-the-counter medicines and home remedies, even if their names are not known."}
                </p>
                {questions[currentQuestion]?.id === "pain_site" && (
                  <div
                    className="body-guide"
                    aria-label="Schematic abdomen location guide"
                  >
                    <p>Patient’s right ← &nbsp; → Patient’s left</p>
                    <div className="abdomen-grid">
                      {[
                        "Right upper",
                        "Upper middle",
                        "Left upper",
                        "Right side",
                        "Navel",
                        "Left side",
                        "Right lower",
                        "Lower middle",
                        "Left lower",
                      ].map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </div>
                    <small>
                      Schematic location guide. Choose “Not sure” if needed.
                    </small>
                  </div>
                )}
                <p>
                  Choose “Not sure” if you don’t know. No answer is assumed to
                  be “No”.
                </p>
                <div className="question-progress" aria-hidden="true">
                  {questions.map((q, i) => (
                    <span
                      key={q.id}
                      className={i <= currentQuestion ? "done" : ""}
                    />
                  ))}
                </div>
                <p className="notice block">
                  You can save and pause. If seriously unwell, tell clinic staff
                  and seek immediate medical assistance.
                </p>
              </aside>
            </div>
          ) : step === 5 ? (
            <section className="panel">
              <ReportLibrary
                encounter={encounter}
                patient
                onChange={(e) => {
                  revision.current = e.version;
                  setEncounter(e);
                }}
              />
            </section>
          ) : (
            <div className="demo-split">
              <section className="panel">
                <h2>Check the information</h2>
                <p>
                  <strong>{intake.name}</strong> · {intake.age} years ·{" "}
                  {intake.sex}
                </p>
                <p>
                  {intake.suppliedBy === "caregiver"
                    ? `Answers from caregiver (${intake.relationship || "relationship not supplied"})`
                    : "Patient-reported"}{" "}
                  · entered by {intake.enteredBy}
                </p>
                {layout ? (
                  <TopicAnswerReview
                    version={questionnaire.version}
                    answers={intake.answers}
                  />
                ) : (
                  <AnswerSummary
                    questions={questionnaire.questions.filter(
                      (q) =>
                        isActive(q, intake.answers, questionnaire) ||
                        intake.answers[q.id] ||
                        intake.answers[q.id + "__note"],
                    )}
                    answers={intake.answers}
                    active={activeAnswers(
                      intake.answers,
                      questionnaire.version,
                    )}
                  />
                )}
              </section>
              <aside className="stack">
                <OptionalTopics
                  version={questionnaire.version}
                  answers={intake.answers}
                  busy={busy}
                  onNavigate={(target, nav) => void move(target, nav)}
                />
                <section className="panel">
                  <h2>Ready for review</h2>
                  <p>
                    {encounter.reports.length} report(s) added. Only confirmed
                    transcriptions will inform the AI.
                  </p>
                  <p>
                    You can submit with unanswered questions. Missing
                    information stays visible to the clinician.
                  </p>
                  <button disabled={busy} onClick={() => void submit()}>
                    Submit for AI and clinician review
                  </button>
                </section>
              </aside>
            </div>
          )}
          {step > 0 && (
            <footer className="flow-footer">
              {!guidedQuestion && (
                <button
                  className="secondary"
                  disabled={busy || step <= 1}
                  onClick={() => void navigateQuestion(-1)}
                >
                  ← Back
                </button>
              )}
              <span className="muted">{saveState}</span>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void save({ ...intake, stage: step })
                      .then(() => {
                        setSaveState("Saved securely");
                        setPaused(true);
                        window.scrollTo({ top: 0 });
                      })
                      .catch((e) => setError(e.message))
                  }
                >
                  Save and pause
                </button>
                {step < 6 && !guidedQuestion && (
                  <button
                    disabled={busy}
                    onClick={() => void navigateQuestion(1)}
                  >
                    {step === 5 && !encounter.reports.length
                      ? "Continue without reports"
                      : "Continue →"}
                  </button>
                )}
              </div>
            </footer>
          )}
        </>
      )}
      <footer className="demo-footer">
        <span>GI Compass · Your information supports your care.</span>
        <span>
          If you need urgent assistance, tell clinic staff or visit a hospital.
        </span>
      </footer>
    </main>
  );
}
