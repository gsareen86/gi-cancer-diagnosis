import { describe, it, expect } from "vitest";
import {
  reportStatus,
  canRetryReport,
  reportFailureReason,
} from "../../src/lib/demo/report-status";
import type { DemoReport } from "../../src/lib/demo/types";
const base: DemoReport = {
  id: "fake",
  name: "Fictional.pdf",
  mime: "application/pdf",
  fields: [],
  quality: "",
  createdAt: "",
  verifiedAt: null,
  verifier: null,
};
describe("Report processing feedback", () => {
  it("distinguishes pending, progress, no findings and failure", () => {
    expect(reportStatus({ ...base, extractionStatus: "queued" })).toBe(
      "Waiting to process",
    );
    expect(
      reportStatus({
        ...base,
        extractionStatus: "running",
        extractionProgress: { pagesDone: 2, totalPages: 3 },
      }),
    ).toContain("2 of 3 pages read");
    expect(reportStatus({ ...base, extractionStatus: "completed" })).toBe(
      "No findings extracted",
    );
    expect(reportStatus({ ...base, extractionStatus: "failed" })).toBe(
      "Processing failed",
    );
  });
  it("offers retry only for failed or interrupted unverified empty reports", () => {
    const running = {
      ...base,
      extractionStatus: "running" as const,
      extractionUntil: "2026-09-22T17:00:00Z",
    };
    const now = Date.parse("2026-09-22T18:00:00Z");
    expect(reportStatus(running, now)).toBe("Processing interrupted");
    expect(canRetryReport(running, now)).toBe(true);
    expect(canRetryReport(running, now - 7_200_000)).toBe(false);
    expect(
      canRetryReport({
        ...base,
        extractionStatus: "failed",
        verifiedAt: "2026-09-22",
      }),
    ).toBe(false);
  });
  it("never displays an arbitrary processor error", () => {
    expect(
      reportFailureReason({
        ...base,
        extractionError: "sensitive source content",
      }),
    ).toBe("Automatic extraction could not finish.");
    expect(
      reportFailureReason({
        ...base,
        extractionError: "provider_rate_limited",
      }),
    ).toContain("request limit");
  });
});
