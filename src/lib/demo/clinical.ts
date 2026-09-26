import { z } from "zod";
import { flowFor } from "./intake-flow";
import {
  content,
  contentFor,
  activeAnswers,
  answerValues,
  answerText,
  isActive,
  isValidAnswer,
  visibleQuestions,
  uncertain,
  type Answers,
} from "./questionnaire";
export {
  content,
  contentFor,
  activeAnswers,
  answerValues,
  answerText,
  visibleQuestions,
};
export type { Answers };
export type Urgency = "review" | "prompt" | "immediate";
export const urgencyNames: Record<Urgency, string> = {
  review: "Clinician review needed",
  prompt: "Prompt clinical review",
  immediate: "Immediate assistance needed",
};
export function evaluate(answers: Answers, version = content.version) {
  const doc = contentFor(version);
  const active = activeAnswers(answers, version);
  const matches = doc.rules.filter((r) =>
    r.all.every((c) => {
      const q = doc.questions.find((q) => q.id === c.field);
      return (
        !!q &&
        isValidAnswer(doc, q.id, active[c.field] ?? "") &&
        answerValues(q, active[c.field]).some((v) => c.values.includes(v))
      );
    }),
  );
  const urgency = matches.reduce<Urgency>(
    (u, r) =>
      doc.urgencies.indexOf(r.urgency) > doc.urgencies.indexOf(u)
        ? (r.urgency as Urgency)
        : u,
    "review",
  );
  const missing = visibleQuestions("safety", answers, version)
    .filter(
      (q) =>
        q.section === "safety" &&
        (!answers[q.id] ||
          answerValues(q, answers[q.id]).some((v) => uncertain.includes(v))),
    )
    .map((q) => q.id);
  return { urgency, matches, missing, advice: doc.advice[urgency] };
}
export const intakeShape = z
  .object({
    name: z.string().max(80),
    age: z.number().int().min(18).max(110),
    sex: z.enum([
      "Female",
      "Male",
      "Intersex",
      "Other",
      "Prefer not to answer",
    ]),
    suppliedBy: z.enum(["patient", "caregiver"]),
    enteredBy: z.enum(["patient", "coordinator"]),
    relationship: z.string().max(80).default(""),
    answers: z.record(z.string(), z.string().max(2000)),
    answerSources: z
      .record(
        z.string(),
        z
          .object({
            suppliedBy: z.enum(["patient", "caregiver"]),
            enteredBy: z.enum(["patient", "coordinator"]),
          })
          .strict(),
      )
      .optional(),
    stage: z.number().int().min(0).max(6),
    navigation: z
      .object({
        flowVersion: z.string().max(80),
        topicId: z.string().max(80),
        mode: z.enum(["main", "detail"]),
      })
      .strict()
      .optional(),
  })
  .strict();
export function intakeSchemaFor(version = content.version) {
  const doc = contentFor(version);
  return intakeShape.superRefine((value, ctx) => {
    if (value.navigation) {
      const layout = flowFor(version);
      if (
        !layout ||
        value.navigation.flowVersion !== layout.version ||
        !layout.topics.some((t) => t.id === value.navigation!.topicId)
      )
        ctx.addIssue({
          code: "custom",
          message: "Unsupported intake navigation",
          path: ["navigation"],
        });
    }
    for (const [id, answer] of Object.entries(value.answers)) {
      if (!isValidAnswer(doc, id, answer))
        ctx.addIssue({
          code: "custom",
          message: "Invalid answer",
          path: ["answers", id],
        });
    }
    for (const id of Object.keys(value.answerSources ?? {}))
      if (!(id in value.answers))
        ctx.addIssue({
          code: "custom",
          message: "Source without an answer",
          path: ["answerSources", id],
        });
  });
}
export const intakeSchema = intakeSchemaFor();
export type Intake = z.infer<typeof intakeSchema>;
export function patchIntake(intake: Intake, patch: Partial<Intake>): Intake {
  const next = { ...intake, ...patch };
  // Keep the original reporter/enterer when someone assists later in the visit.
  const sources = { ...intake.answerSources };
  for (const id of Object.keys(intake.answers))
    sources[id] ??= {
      suppliedBy: intake.suppliedBy,
      enteredBy: intake.enteredBy,
    };
  for (const [id, value] of Object.entries(patch.answers ?? {}))
    if (value !== intake.answers[id])
      sources[id] = { suppliedBy: next.suppliedBy, enteredBy: next.enteredBy };
  next.answerSources = Object.fromEntries(
    Object.entries(sources).filter(([id]) => id in next.answers),
  );
  return next;
}
export type Fact = {
  id: string;
  label: string;
  value: string;
  source: string;
  sourceText?: string;
  reportId?: string;
  reportName?: string;
  reportType?: string;
  page?: number;
  verification?: "staff-reviewed" | "machine-extracted";
};
export const reportTypeSchema = z.enum([
  "blood-test",
  "urine-test",
  "stool-test",
  "ultrasound",
  "ct",
  "mri",
  "x-ray",
  "endoscopy",
  "pathology",
  "other",
  "unknown",
]);
export const evidenceSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(500),
  unit: z.string().max(30),
  page: z.number().int().min(1).max(30),
  sourceText: z.string().min(1).max(2000),
  confidence: z.enum([
    "text-extracted",
    "vision-extracted",
    "manual-transcription",
  ]),
  verified: z.boolean(),
  date: z.string().max(30),
  referenceRange: z.string().max(200).optional(),
  rejected: z.boolean().optional(),
  reportType: reportTypeSchema.optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export type ReportSource = {
  id: string;
  name?: string;
  fields: Evidence[];
  extractionStatus?: string;
  extractionMetadata?: {
    provider?: string;
    model?: string;
    promptVersion?: string;
  };
};
export function usableReportFinding(f: Evidence, status?: string) {
  return (
    !f.rejected &&
    (f.verified ||
      ((f.confidence === "text-extracted" ||
        f.confidence === "vision-extracted") &&
        (!status || status === "completed")))
  );
}
export function factsFor(
  intake: Intake,
  reports: ReportSource[] = [],
  version = content.version,
): Fact[] {
  const doc = contentFor(version);
  const active = activeAnswers(intake.answers, version);
  const unanswered = doc.questions.filter(
    (q) => isActive(q, intake.answers, doc) && !active[q.id]?.trim(),
  );
  const inactive = doc.questions.filter(
    (q) =>
      !isActive(q, intake.answers, doc) &&
      (intake.answers[q.id] || intake.answers[`${q.id}__note`]),
  );
  const sourceFor = (id: string) => {
    const source = intake.answerSources?.[id] ?? intake;
    return `${source.suppliedBy}-reported; ${source.enteredBy}-entered`;
  };
  return [
    { id: "age", label: "Age", value: String(intake.age), source: "Intake" },
    { id: "sex", label: "Sex", value: intake.sex, source: "Intake" },
    ...(unanswered.length
      ? [
          {
            id: "unanswered_questions",
            label: "Questions not yet answered",
            value: unanswered.map((q) => q.label).join("; "),
            source:
              "Incomplete questionnaire; these are unknown, never negative findings",
          },
        ]
      : []),
    ...(inactive.length
      ? [
          {
            id: "inactive_answers",
            label: "Earlier details needing reconciliation",
            value: inactive.map((q) => q.label).join("; "),
            source:
              "Earlier answers no longer apply to current parent selections; not current clinical findings",
          },
        ]
      : []),
    ...doc.questions
      .filter((q) => active[q.id]?.trim() || active[`${q.id}__note`]?.trim())
      .flatMap((q) => [
        ...(active[q.id]?.trim()
          ? [
              {
                id: q.id,
                label: q.label,
                value: answerText(q, active[q.id]),
                source: sourceFor(q.id),
              },
            ]
          : []),
        ...(active[`${q.id}__note`]?.trim()
          ? [
              {
                id: `${q.id}__note`,
                label: `Additional detail: ${q.label}`,
                value: active[`${q.id}__note`],
                source: `${sourceFor(`${q.id}__note`)}; free text, not a structured rule input`,
              },
            ]
          : []),
      ]),
    ...reports.flatMap((r) => [
      ...(!r.fields.some((f) => usableReportFinding(f, r.extractionStatus))
        ? [
            {
              id: `report-status:${r.id}`,
              label: `Report availability: ${r.name || "uploaded report"}`,
              value: `Report findings unavailable for assessment (${r.extractionStatus || "no usable findings"}). Results remain unknown; do not infer a negative or normal result.`,
              source: "Report processing status; not a medical finding",
            },
          ]
        : []),
      ...r.fields
        .filter((f) => usableReportFinding(f, r.extractionStatus))
        .map((f) => ({
          id: `report:${r.id}:${f.id}`,
          label: f.label,
          value: `${f.value} ${f.unit} (${f.date || "date not supplied"})${f.referenceRange ? `; printed reference interval: ${f.referenceRange}` : ""}`,
          source: `${f.verified ? "Staff-reviewed finding" : `${f.confidence === "vision-extracted" ? "Machine image extraction" : "Machine text extraction"}; not reviewed by staff`}, ${r.name || "report"} (${r.id}), page ${f.page}; report type: ${f.reportType || "unknown"}`,
          sourceText: f.sourceText,
          reportId: r.id,
          reportName: r.name || "Uploaded report",
          reportType: f.reportType || "unknown",
          page: f.page,
          verification: f.verified
            ? ("staff-reviewed" as const)
            : ("machine-extracted" as const),
        })),
    ]),
  ];
}
export const assessmentSchema = z
  .object({
    summary: z.string().min(10).max(1000),
    urgency: z.enum(["review", "prompt", "immediate"]),
    specialty: z.enum([
      "Gastroenterology",
      "GI / HPB surgery",
      "Surgical oncology",
      "General medicine",
      "Emergency department",
    ]),
    specialtyReason: z.string().max(400).optional(),
    possibilities: z
      .array(
        z
          .object({
            name: z.string().min(3).max(100),
            reason: z.string().min(5).max(600),
            evidenceIds: z.array(z.string()).min(1).max(8),
            uncertainty: z.string().min(5).max(400),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    missingInformation: z.array(z.string().max(200)).min(1).max(8),
    nextSteps: z
      .array(
        z.union([
          z.string().max(300),
          z
            .object({
              name: z.string().min(3).max(100),
              why: z.string().min(5).max(300),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(5),
    regionalConsideration: z
      .object({
        condition: z.literal("Abdominal tuberculosis"),
        comment: z.string().min(5).max(600),
        evidenceIds: z.array(z.string()).max(8),
      })
      .strict(),
  })
  .strict();
export type Assessment = z.infer<typeof assessmentSchema>;
const forbidden =
  /(\b(high|moderate|low|likely|unlikely|most likely)\s+(probability|likelihood|risk)\b|\b(most|less|more)\s+likely\b|\d\s*%|\b(no (serious|need|cancer)|nothing to worry|ruled? out|definitely|confirmed diagnosis|you have cancer|this is benign|only benign|reassur)|\b(stage\s+[iv1-4]+|resectable|unresectable)\b|\b\d+\s*(tablets?|capsules?)\b|\b(start|take|prescribe|stop)\s+(omeprazole|pantoprazole|aspirin|ibuprofen|antibiotics?)\b)/i;
export function validateAssessment(
  raw: unknown,
  facts: Fact[],
  floor: Urgency,
): Assessment {
  const result = assessmentSchema.parse(raw);
  if (
    /\b(?:has|have|was|were) not (?:yet )?(?:been )?(?:performed|done|completed)\b|\bnever (?:been )?(?:performed|done|completed)\b|\bno\b[^.!?":]{0,300}\b(?:has|have|was|were) (?:been )?(?:performed|done|completed)\b/i.test(
      JSON.stringify(result),
    )
  )
    throw new Error("output_boundary", {
      cause: "describe_unavailable_test_results_not_unperformed_tests",
    });
  // Regression guard for invented negative imaging findings. The semantic check also
  // evaluates every other patient-specific claim against its supplied evidence.
  const negativeMass =
    /\bno\s+(?:abdominal\s+|bowel\s+|colonic\s+)?(?:mass|masses|lesions?|tumou?rs?)\b/i;
  if (
    negativeMass.test(JSON.stringify(result)) &&
    !facts.some((f) => f.reportId && negativeMass.test(f.sourceText ?? ""))
  )
    throw new Error("unsupported_evidence", {
      cause: "unsupported_negative_finding",
    });
  const uncertainties = result.possibilities.map((p) =>
    p.uncertainty.toLowerCase().replace(/\s+/g, " ").trim(),
  );
  if (new Set(uncertainties).size !== uncertainties.length)
    throw new Error("output_boundary", { cause: "duplicate_uncertainty" });
  // Future investigations to rule out a condition do not claim it is excluded.
  const boundaryText = JSON.stringify(result)
    .replace(
      /\bnot a confirmed diagnosis\b|\bcannot be ruled out\b|\bhas not been ruled out\b|\b(must|needs to|should) be ruled out\b|\bto rule out\b/gi,
      "uncertain",
    )
    .replace(/\b\d+(?:\.\d+)?\s*%/g, (value) =>
      facts.some((fact) =>
        fact.value.replace(/\s/g, "").includes(value.replace(/\s/g, "")),
      )
        ? "recorded percentage"
        : value,
    );
  if (/\b(most|less|more)\s+(likely|common)\b/i.test(boundaryText))
    throw new Error("output_boundary", { cause: "comparative_likelihood" });
  const boundaryMatch = forbidden.exec(boundaryText);
  if (boundaryMatch)
    throw new Error("output_boundary", { cause: boundaryMatch[0] });
  const ids = new Set(facts.map((f) => f.id));
  for (const item of [...result.possibilities, result.regionalConsideration])
    if (item.evidenceIds.some((id) => !ids.has(id)))
      throw new Error("unsupported_evidence");
  if (
    content.urgencies.indexOf(result.urgency) < content.urgencies.indexOf(floor)
  )
    result.urgency = floor;
  return result;
}
export const reviewSchema = z
  .object({
    impression: z
      .string()
      .trim()
      .min(1, "Enter a clinical impression.")
      .max(2000),
    specialty: z.enum([
      "Gastroenterology",
      "GI / HPB surgery",
      "Surgical oncology",
      "General medicine",
      "Emergency department",
    ]),
    urgency: z.enum(["review", "prompt", "immediate"]),
    plan: z
      .string()
      .trim()
      .min(1, "Add instructions for the patient.")
      .max(3000),
    investigations: z.array(z.string().min(1).max(120)).max(12).optional(),
    followUp: z.string().max(1000).optional(),
    urgencyReason: z.string().max(500).optional(),
    privateNotes: z.string().max(3000),
    priorExposure: z.enum([
      "not_exposed",
      "patient_disclosed",
      "previously_seen",
    ]),
    disagreement: z.enum([
      "not_compared",
      "agree",
      "different_diagnosis",
      "different_urgency",
      "different_specialty",
      "missing_evidence",
      "other",
    ]),
    reason: z.string().max(1000),
  })
  .strict();
export type Review = z.infer<typeof reviewSchema>;
