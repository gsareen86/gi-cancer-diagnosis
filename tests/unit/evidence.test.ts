import { describe, expect, it } from "vitest";
import {
  inspectRegistry,
  mergeEvidence,
} from "../../scripts/invariant-lib.mjs";
const ids = [
  ...Array.from({ length: 10 }, (_, i) => `S${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `D${i + 1}`),
];
function registry() {
  return {
    invariants: ids.map((id) => ({
      id,
      controls: [
        {
          id: `${id}.one`,
          owner: "foundation",
          rationale: "Synthetic checker test",
          status: "verified",
          evidenceType: "automated",
          tests: ["executed assertion"],
        },
      ],
    })),
  };
}
const identity = { commit: "current", artifactHash: "source-v1" };
describe("Invariant evidence integrity", () => {
  it("combines current suites without promoting stale results", () => {
    const result = mergeEvidence(
      [
        { ...identity, tests: [{ id: "unit", status: "passed" }] },
        { ...identity, tests: [{ id: "database", status: "passed" }] },
        {
          ...identity,
          artifactHash: "old",
          tests: [{ id: "stale", status: "passed" }],
        },
      ],
      identity,
    );
    expect(result.tests).toEqual([
      { id: "unit", status: "passed" },
      { id: "database", status: "passed" },
    ]);
  });
  it("does not hide a failed or skipped result behind a duplicate pass", () => {
    const result = mergeEvidence(
      [
        { ...identity, tests: [{ id: "same", status: "skipped" }] },
        { ...identity, tests: [{ id: "same", status: "passed" }] },
      ],
      identity,
    );
    expect(result.tests[0].status).toBe("skipped");
  });
  it("rejects missing results and evidence from another commit", () => {
    expect(
      inspectRegistry(registry(), null, identity).errors.some((e) =>
        e.includes("missing evidence"),
      ),
    ).toBe(true);
    expect(
      inspectRegistry(
        registry(),
        {
          ...identity,
          commit: "other",
          tests: [{ id: "executed assertion", status: "passed" }],
        },
        identity,
      ).errors.some((e) => e.includes("Stale")),
    ).toBe(true);
  });
  it("rejects unknown tags attached to actual test evidence", () => {
    expect(
      inspectRegistry(
        registry(),
        {
          ...identity,
          tests: [{ id: "[S99] undeclared rule", status: "passed" }],
        },
        identity,
      ).errors.some((e) => e.includes("Unknown invariant tag")),
    ).toBe(true);
  });
  it("rejects a passing tag with skipped execution", () => {
    const result = inspectRegistry(
      registry(),
      { ...identity, tests: [{ id: "executed assertion", status: "pending" }] },
      identity,
    );
    expect(result.errors.some((e) => e.includes("skipped"))).toBe(true);
  });
  it("rejects test results from another source snapshot", () => {
    expect(
      inspectRegistry(
        registry(),
        {
          ...identity,
          artifactHash: "old",
          tests: [{ id: "executed assertion", status: "passed" }],
        },
        identity,
      ).errors.some((e) => e.includes("Stale")),
    ).toBe(true);
  });
  it("retains partial coverage when encounter reset is deferred", () => {
    const data = registry();
    data.invariants
      .find((i) => i.id === "D2")!
      .controls.push({
        id: "D2.reset",
        owner: "encounters-and-consent",
        rationale: "Encounter reset is implemented by a later change",
        status: "deferred",
        evidenceType: "automated",
        tests: [],
      });
    const result = inspectRegistry(
      data,
      { ...identity, tests: [{ id: "executed assertion", status: "passed" }] },
      identity,
    );
    expect(result.errors).toEqual([]);
    expect(result.summary.D2).toBe("partial");
  });
  it("rejects unknown invariant claims", () => {
    const data = registry();
    data.invariants[0].id = "S99";
    expect(inspectRegistry(data, null, identity).errors).not.toEqual([]);
  });
});
