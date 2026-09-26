import { describe, it, expect } from "vitest";
import { factsFor, type Evidence } from "../../src/lib/demo/clinical";
import { scenarios } from "../../src/lib/demo/fixtures";

const base: Evidence = {
  id: "printed-1",
  label: "Printed finding",
  value: "Synthetic recorded observation",
  unit: "",
  date: "2026-09-01",
  page: 2,
  sourceText: "Synthetic recorded observation",
  confidence: "text-extracted",
  verified: false,
};
const reportFacts = (fields: Evidence[], extractionStatus = "completed") =>
  factsFor(scenarios[0].intake, [
    {
      id: "fictional-report",
      name: "Fictional written report",
      fields,
      extractionStatus,
    },
  ]).filter((f) => f.id.startsWith("report:"));

describe("Automatic attributed report evidence", () => {
  for (const reportType of [
    "blood-test",
    "ultrasound",
    "ct",
    "mri",
    "endoscopy",
    "pathology",
    "other",
  ] as const)
    it(`includes unreviewed ${reportType} written findings with source/date/page provenance`, () => {
      const facts = reportFacts([{ ...base, reportType }]);
      expect(facts).toHaveLength(1);
      expect(facts[0].source).toContain("not reviewed by staff");
      expect(facts[0].source).toContain("page 2");
      expect(facts[0].source).toContain("Fictional written report");
      expect(facts[0].sourceText).toBe(base.sourceText);
      expect(facts[0].reportType).toBe(reportType);
      expect(facts[0].value).toContain("2026-09-01");
    });
  it("includes vision extraction without calling it verified", () => {
    expect(
      reportFacts([{ ...base, confidence: "vision-extracted" }])[0].source,
    ).toContain("image extraction");
  });
  it("preserves a printed reference interval as source evidence, not a universal clinical threshold", () => {
    const facts = reportFacts([
      { ...base, value: "10.4", unit: "g/dL", referenceRange: "13.0 - 17.0" },
    ]);
    expect(facts[0].value).toContain("printed reference interval: 13.0 - 17.0");
  });
  it("excludes rejected and unconfirmed manual findings", () => {
    expect(
      reportFacts([
        { ...base, rejected: true },
        { ...base, id: "manual", confidence: "manual-transcription" },
      ]),
    ).toEqual([]);
    expect(
      reportFacts([
        { ...base, confidence: "manual-transcription", verified: true },
      ])[0].source,
    ).toContain("Staff-reviewed");
  });
  it("does not use machine findings from unfinished or failed extraction", () => {
    for (const status of ["queued", "running", "failed", "cancelled"])
      expect(reportFacts([base], status)).toEqual([]);
  });
  it("makes missing/failed reports explicit without inventing negative findings", () => {
    const facts = factsFor(scenarios[0].intake, [
      {
        id: "failed-report",
        name: "Fictional CT report",
        extractionStatus: "failed",
        fields: [],
      },
    ]);
    expect(
      facts.find((f) => f.id === "report-status:failed-report")?.value,
    ).toContain("unavailable");
    expect(facts.some((f) => f.id.startsWith("report:"))).toBe(false);
  });
});
