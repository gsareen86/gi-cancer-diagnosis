import { describe, it, expect } from "vitest";
import {
  contentFor,
  evaluate as evaluateVersion,
  visibleQuestions as visibleVersion,
  intakeSchema,
  validateAssessment,
} from "../../src/lib/demo/clinical";
const content = contentFor("demo-draft-2026-09-21");
const evaluate = (answers: Record<string, string>) =>
  evaluateVersion(answers, content.version);
const visibleQuestions = (section: string, answers: Record<string, string>) =>
  visibleVersion(section, answers, content.version);
describe("DRAFT demo safety boundaries", () => {
  it("makes every rule dependency universally reachable", () => {
    for (const rule of content.rules)
      for (const term of rule.all)
        expect(
          content.questions.find((q) => q.id === term.field)?.showWhen,
        ).toBeNull();
  });
  for (const rule of content.rules)
    it(`matches ${rule.id}, not unknown or declined`, () => {
      const answers = Object.fromEntries(
        rule.all.map((t) => [t.field, t.values[0]]),
      );
      expect(evaluate(answers).matches.map((r) => r.id)).toContain(rule.id);
      for (const value of ["Not sure", "Prefer not to answer", ""])
        expect(
          evaluate({ ...answers, [rule.all[0].field]: value }).matches.map(
            (r) => r.id,
          ),
        ).not.toContain(rule.id);
    });
  it("finds biliary danger independently of symptom entry order", () =>
    expect(
      evaluate({ pain_site: "Right upper", fever: "Yes", jaundice: "Yes" })
        .urgency,
    ).toBe("immediate"));
  it("keeps missing questions separate from negatives", () =>
    expect(evaluate({}).missing.length).toBeGreaterThan(10));
  it("does not show pain details for unknown pain location", () =>
    expect(
      visibleQuestions("symptoms", { pain_site: "Not sure" }).some(
        (q) => q.id === "pain_score",
      ),
    ).toBe(false));
  it("rejects invalid age and clinical choices", () =>
    expect(
      intakeSchema.safeParse({
        name: "Synthetic",
        age: 8,
        sex: "Male",
        suppliedBy: "patient",
        enteredBy: "patient",
        answers: { fever: "never" },
        stage: 0,
      }).success,
    ).toBe(false));
  const assessment = {
    summary: "Symptoms require clinical evaluation.",
    urgency: "review",
    specialty: "Gastroenterology",
    possibilities: [
      {
        name: "Gastritis",
        reason: "Upper abdominal discomfort is reported.",
        evidenceIds: ["pain"],
        uncertainty: "An examination and further history are needed.",
      },
    ],
    missingInformation: ["Examination findings"],
    nextSteps: ["Arrange medical assessment."],
    regionalConsideration: {
      condition: "Abdominal tuberculosis",
      comment: "Exposure history is unknown.",
      evidenceIds: [],
    },
  };
  const facts = [
    {
      id: "pain",
      label: "Pain",
      value: "Upper abdominal discomfort",
      source: "patient",
    },
  ];
  it("prevents AI from lowering urgency", () =>
    expect(validateAssessment(assessment, facts, "immediate").urgency).toBe(
      "immediate",
    ));
  it("rejects fabricated evidence", () =>
    expect(() => validateAssessment(assessment, [], "review")).toThrow(
      "unsupported_evidence",
    ));
  it("rejects identical uncertainty copied across different possibilities", () => {
    expect(() =>
      validateAssessment(
        {
          ...assessment,
          possibilities: [
            assessment.possibilities[0],
            { ...assessment.possibilities[0], name: "Another explanation" },
          ],
        },
        facts,
        "review",
      ),
    ).toThrow("output_boundary");
  });
  it.each([
    "A colonoscopy has not been performed.",
    "No physical examination, blood tests, or imaging have been completed yet.",
    "No imaging studies, endoscopic evaluations, or tissue examinations have been performed.",
    "An examination was not completed.",
  ])("rejects an inferred unperformed test or examination: %s", (summary) => {
    expect(() =>
      validateAssessment({ ...assessment, summary }, facts, "review"),
    ).toThrow("output_boundary");
  });
  it("accepts unavailable results and future plans without inferring whether tests happened", () => {
    const summary =
      "No examination results are available. Further tests may be performed after clinical review.";
    expect(
      validateAssessment({ ...assessment, summary }, facts, "review").summary,
    ).toBe(summary);
  });
  it("rejects the earlier invented no-mass reassurance without an explicit original report", () => {
    expect(() =>
      validateAssessment(
        { ...assessment, summary: "However, no mass has been detected." },
        facts,
        "review",
      ),
    ).toThrow("unsupported_evidence");
  });
  it("accepts explicit uncertainty without accepting confirmed diagnoses", () =>
    expect(
      validateAssessment(
        {
          ...assessment,
          summary: "This is a possibility, not a confirmed diagnosis.",
        },
        facts,
        "review",
      ).summary,
    ).toContain("not a confirmed diagnosis"));
  it("distinguishes future investigation from an affirmative exclusion", () => {
    expect(
      validateAssessment(
        {
          ...assessment,
          summary: "Clinical assessment is needed to rule out serious causes.",
        },
        facts,
        "review",
      ).summary,
    ).toContain("needed to rule out");
    expect(() =>
      validateAssessment(
        { ...assessment, summary: "Serious causes have been ruled out." },
        facts,
        "review",
      ),
    ).toThrow("output_boundary");
  });
  it("does not mistake a lab concentration for a medication dose", () =>
    expect(
      validateAssessment(
        {
          ...assessment,
          summary:
            "A reported bilirubin of 8 mg/dL needs clinician interpretation.",
        },
        facts,
        "review",
      ).summary,
    ).toContain("mg/dL"));
  it("rejects reassuring and prescription output", () => {
    for (const summary of [
      "No serious disease is present.",
      "Take omeprazole 20 mg daily.",
      "High likelihood of cancer.",
    ])
      expect(() =>
        validateAssessment({ ...assessment, summary }, facts, "review"),
      ).toThrow();
  });
});
