import { describe, it, expect } from "vitest";
import prompts from "../../src/lib/ai/prompts.json";
import {
  isCurrentAssessment,
  projectAssessmentState,
} from "../../src/lib/demo/assessment-state";
describe("Current preliminary assessment projection", () => {
  it("withholds older output while preserving the separate released clinician plan", () => {
    const prior = {
      aiAvailable: true,
      aiPromptVersion: "old",
      ai: { summary: "old output" },
      release: { plan: "Authored clinician plan" },
      reports: [],
    };
    const projected = projectAssessmentState(prior);
    expect(projected.ai).toBeNull();
    expect(projected.aiAvailable).toBe(false);
    expect(projected.release).toEqual(prior.release);
    expect(prior.ai).not.toBeNull();
  });
  it("does not show a complete-looking assessment while report processing is pending", () => {
    expect(
      projectAssessmentState({
        aiAvailable: true,
        aiPromptVersion: prompts.version,
        ai: {},
        reports: [{ extractionStatus: "running" }],
      }).ai,
    ).toBeNull();
  });
  it("requires a pinned source snapshot for current AI display", () => {
    expect(isCurrentAssessment({ promptVersion: prompts.version })).toBe(false);
    expect(
      isCurrentAssessment({ promptVersion: prompts.version, sourceFacts: [] }),
    ).toBe(true);
  });
});
