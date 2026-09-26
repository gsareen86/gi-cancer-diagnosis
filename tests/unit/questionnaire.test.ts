import { describe, expect, it } from "vitest";
import {
  content,
  evaluate,
  visibleQuestions,
  factsFor,
  intakeSchema,
  type Answers,
} from "../../src/lib/demo/clinical";
import { blankIntake } from "../../src/lib/demo/fixtures";
import { scenarios } from "../../src/lib/demo/fixtures";
import {
  contentFor,
  intakeSchemaFor,
  patchIntake,
} from "../../src/lib/demo/clinical";
import { type Term } from "../../src/lib/demo/questionnaire";

describe("DRAFT contextual questionnaire", () => {
  const current = {
    pain_presence: "Pain is present now",
    pain_now_severity: "Severe — I cannot carry on with usual activities",
  };
  it("requires current pain and current severity, without waiting for unrelated symptoms", () => {
    expect(evaluate({ pain_presence: current.pain_presence }).urgency).not.toBe(
      "immediate",
    );
    expect(evaluate(current).urgency).toBe("immediate");
    expect(
      evaluate(Object.fromEntries(Object.entries(current).reverse())).urgency,
    ).toBe("immediate");
  });
  it("does not mistake intermittent historical severe pain for severe pain now", () => {
    const answers = {
      pain_presence: "Pain comes and goes; no pain right now",
      pain_started: "More than 3 months ago",
      pain_score: "10",
      pain_now_severity: current.pain_now_severity,
    };
    expect(evaluate(answers).urgency).not.toBe("immediate");
    expect(visibleQuestions("symptoms", answers).map((q) => q.id)).toEqual(
      expect.arrayContaining([
        "pain_frequency",
        "pain_episode_length",
        "pain_relief",
      ]),
    );
    const facts = factsFor({ ...blankIntake, age: 40, answers });
    expect(facts.some((f) => f.id === "pain_now_severity")).toBe(false);
    expect(facts.find((f) => f.id === "pain_score")?.value).toBe("10");
  });
  it("separates recovered fainting from incomplete recovery and sudden confusion", () => {
    expect(
      evaluate({
        faint: "Passed out or lost consciousness",
        faint_timing: "More than a week ago, now stopped",
        faint_recovery: "Fully recovered and back to usual",
      }).urgency,
    ).not.toBe("immediate");
    expect(
      evaluate({
        faint: "Lightheaded or dizzy, without passing out",
        faint_recovery: "Still lightheaded but able to sit and talk normally",
      }).urgency,
    ).not.toBe("immediate");
    expect(
      evaluate({
        faint: "Passed out or lost consciousness",
        faint_recovery:
          "Not fully recovered, hard to wake, or difficulty speaking or moving",
      }).urgency,
    ).toBe("immediate");
    expect(
      evaluate({
        confusion: "A new change in awareness or confusion",
        confusion_onset: "Suddenly, and it is happening now or happened today",
      }).urgency,
    ).toBe("immediate");
  });
  const obstruction: Answers = {
    distended: "Swollen now and not settling",
    no_gas: "Unable to pass either stool or gas",
    vomiting: "Vomiting today",
    obstruction_episode: "Yes, together in this episode",
  };
  const biliary: Answers = {
    jaundice: "Yellow now / recently noticed",
    fever: "Feel feverish today, not measured",
    pain_presence: "Pain is present now",
    pain_site: JSON.stringify(["Right upper", "Upper middle"]),
    biliary_episode: "Yes, together in this illness",
  };
  for (const [id, answers, link] of [
    ["obstruction", obstruction, "obstruction_episode"],
    ["biliary_fever", biliary, "biliary_episode"],
  ] as const) {
    it(`requires linked timing for ${id}, including multi-location pain`, () => {
      expect(evaluate(answers).matches.map((r) => r.id)).toContain(id);
      for (const value of [
        "Not sure",
        "Prefer not to answer",
        "",
        "No, at different times",
      ])
        expect(
          evaluate({ ...answers, [link]: value }).matches.map((r) => r.id),
        ).not.toContain(id);
    });
  }
  it("keeps unknown/declined parents from activating stale child answers", () => {
    for (const value of [
      "Not sure",
      "Prefer not to answer",
      "No abdominal pain",
      "",
    ]) {
      const answers = { ...current, pain_presence: value };
      expect(evaluate(answers).urgency).not.toBe("immediate");
      expect(
        factsFor({ ...blankIntake, age: 40, answers }).some(
          (f) => f.id === "pain_now_severity",
        ),
      ).toBe(false);
    }
  });
  it("supports contextual multi-select and free detail while rejecting incompatible options", () => {
    const intake = {
      ...blankIntake,
      age: 40,
      answers: {
        ...biliary,
        pain_site__note: "Also sometimes moves to my back",
      },
    };
    expect(intakeSchema.safeParse(intake).success).toBe(true);
    expect(
      factsFor(intake).some((f) => f.value.includes("moves to my back")),
    ).toBe(true);
    expect(
      intakeSchema.safeParse({
        ...intake,
        answers: { pain_site: JSON.stringify(["Right upper", "Not sure"]) },
      }).success,
    ).toBe(false);
    expect(
      intakeSchema.safeParse({
        ...intake,
        answers: { invented__note: "hello" },
      }).success,
    ).toBe(false);
  });
  it("offers uncertain and declined choices on every selection question", () => {
    for (const q of content.questions.filter((q) => q.kind !== "text"))
      expect(q.options).toEqual(
        expect.arrayContaining(["Not sure", "Prefer not to answer"]),
      );
  });
  it("marks all clinical questions and rules as draft", () => {
    expect(content.status).toBe("DRAFT");
    expect(content.approver).toBeNull();
    for (const rule of content.rules) {
      expect(rule.status).toBe("DRAFT");
      expect(rule.provenance).toBe("assumed");
    }
  });
  it("validates all authored fictional fixtures", () => {
    for (const scenario of scenarios)
      expect(intakeSchema.safeParse(scenario.intake).success, scenario.id).toBe(
        true,
      );
  });
  it("retains each answer's reporter when someone else assists later", () => {
    const first = patchIntake(
      { ...blankIntake, age: 40 },
      { answers: { pain_presence: "Pain is present now" } },
    );
    const assisted = patchIntake(first, {
      suppliedBy: "caregiver",
      enteredBy: "coordinator",
    });
    const next = patchIntake(assisted, {
      answers: { ...assisted.answers, pain_now_severity: "Unbearable pain" },
    });
    expect(factsFor(next).find((f) => f.id === "pain_presence")?.source).toBe(
      "patient-reported; patient-entered",
    );
    expect(
      factsFor(next).find((f) => f.id === "pain_now_severity")?.source,
    ).toBe("caregiver-reported; coordinator-entered");
  });
  it("preserves original answers and rules for old encounters and jobs", () => {
    const version = "demo-draft-2026-09-21";
    const intake = { ...blankIntake, age: 40, answers: { vomit_blood: "Yes" } };
    expect(contentFor(version).version).toBe(version);
    expect(intakeSchemaFor(version).safeParse(intake).success).toBe(true);
    expect(evaluate(intake.answers, version).urgency).toBe("immediate");
    expect(intakeSchema.safeParse(intake).success).toBe(false);
    expect(() => contentFor("invented-version")).toThrow(
      "This questionnaire version is unavailable",
    );
  });
  it("keeps uncertain overlap at least prompt, never an explicit negative", () => {
    expect(
      evaluate({ ...obstruction, obstruction_episode: "Not sure" }).urgency,
    ).toBe("prompt");
    expect(
      evaluate({ ...biliary, biliary_episode: "Prefer not to answer" }).urgency,
    ).toBe("prompt");
  });
  it("cannot lose danger facts first reported through later appearance questions", () => {
    expect(
      evaluate({
        vomit_blood: "No blood noticed / no vomiting",
        vomiting: "Vomiting today",
        vomiting_appearance: "Blood or coffee-ground material",
        appearance_blood_timing: "Happening now",
      }).urgency,
    ).toBe("immediate");
    expect(
      evaluate({
        black_stool: "No black stool",
        stool_colour: "Black and sticky",
        appearance_stool_timing: "Earlier today, now stopped",
      }).urgency,
    ).toBe("immediate");
    expect(
      evaluate({
        rectal_blood: "No red blood noticed",
        stool_colour: "Red or blood mixed in",
        appearance_stool_timing: "Happening now",
        appearance_stool_amount:
          "A large amount, large clots, or bleeding that will not stop",
      }).urgency,
    ).toBe("immediate");
  });
  it("asks amount and retching through the alternative bleeding path", () => {
    const visible = visibleQuestions("symptoms", {
      vomit_blood: "No blood noticed / no vomiting",
      vomiting: "Vomiting today",
      vomiting_appearance: "Blood or coffee-ground material",
    }).map((q) => q.id);
    expect(visible).toContain("vomit_retching");
    expect(visible).toContain("appearance_blood_amount");
  });
  it("does not suppress linked current yellowing and fever for generalised pain", () => {
    expect(
      evaluate({ ...biliary, pain_site: JSON.stringify(["All over"]) }).urgency,
    ).toBe("immediate");
    expect(
      evaluate({ ...biliary, pain_site: JSON.stringify(["Not sure"]) }).urgency,
    ).toBe("immediate");
    expect(
      evaluate(
        { ...biliary, pain_site: JSON.stringify(["All over"]) },
        "intake-draft-2026-09-22.1",
      ).urgency,
    ).toBe("prompt");
  });
  function answerTerm(answers: Answers, term: Term, seen = new Set<string>()) {
    if (seen.has(term.field)) throw new Error("Cyclic dependency");
    const q = content.questions.find((q) => q.id === term.field)!;
    expect(q).toBeDefined();
    const when = q.showWhen;
    if (when && !("id" in when))
      for (const dependency of [
        ...(when.all ?? []),
        ...(when.any?.slice(0, 1) ?? []),
      ])
        answerTerm(answers, dependency, new Set([...seen, term.field]));
    const existing = answers[term.field];
    if (!existing)
      answers[term.field] =
        q.kind === "multi" ? JSON.stringify([term.values[0]]) : term.values[0];
  }
  for (const rule of content.rules)
    it(`covers positive, partial, unknown, negative and reordered ${rule.id}`, () => {
      const answers: Answers = {};
      for (const term of rule.all) answerTerm(answers, term);
      expect(evaluate(answers).matches.map((r) => r.id)).toContain(rule.id);
      expect(
        evaluate(
          Object.fromEntries(Object.entries(answers).reverse()),
        ).matches.map((r) => r.id),
      ).toContain(rule.id);
      for (const term of rule.all) {
        const q = content.questions.find((q) => q.id === term.field)!;
        const negative = q.options.find(
          (v) =>
            !term.values.includes(v) &&
            !["Not sure", "Prefer not to answer"].includes(v),
        );
        for (const value of [
          undefined,
          "Not sure",
          "Prefer not to answer",
          ...(negative ? [negative] : []),
        ]) {
          const altered = { ...answers };
          if (value === undefined) delete altered[term.field];
          else
            altered[term.field] =
              q.kind === "multi" ? JSON.stringify([value]) : value;
          expect(evaluate(altered).matches.map((r) => r.id)).not.toContain(
            rule.id,
          );
        }
      }
    });
});
