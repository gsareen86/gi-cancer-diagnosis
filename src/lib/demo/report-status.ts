import type { DemoReport } from "./types";

export function reportInterrupted(report: DemoReport, now = Date.now()) {
  return (
    report.extractionStatus === "running" &&
    !!report.extractionUntil &&
    Date.parse(report.extractionUntil) < now
  );
}

export function canRetryReport(report: DemoReport, now = Date.now()) {
  return (
    !report.verifiedAt &&
    report.fields.length === 0 &&
    (report.extractionStatus === "failed" || reportInterrupted(report, now))
  );
}

export function reportStatus(report: DemoReport, now = Date.now()) {
  if (report.verifiedAt) return "Staff verified";
  if (report.extractionStatus === "failed") return "Processing failed";
  if (reportInterrupted(report, now)) return "Processing interrupted";
  if (report.extractionStatus === "queued") return "Waiting to process";
  if (report.extractionStatus === "running") {
    const { pagesDone = 0, totalPages = 0 } = report.extractionProgress ?? {};
    return totalPages > 0
      ? `Processing · ${pagesDone} of ${totalPages} pages read`
      : "Processing report";
  }
  if (report.extractionStatus === "cancelled") return "Processing cancelled";
  return report.fields.length
    ? "Processed · Available to AI"
    : "No findings extracted";
}

export function reportFailureReason(report: DemoReport) {
  const reasons: Record<string, string> = {
    vision_unavailable:
      "Some pages need image reading, which is unavailable in the current processor.",
    context_limit: "A report page exceeds the processor’s size limit.",
    model_unavailable: "The report processor could not be reached.",
    provider_not_configured: "The report processor is not configured.",
    provider_auth_failed:
      "The report processor’s connection needs attention from the administrator.",
    provider_rate_limited:
      "The report processor reached its request limit. Try again later.",
    provider_refused: "The report processor could not extract this document.",
    provider_residency_unverified:
      "Processing is unavailable for this site’s data configuration.",
    invalid_output: "The processor’s response could not be validated.",
    output_truncated: "The processor returned an incomplete response.",
    report_findings_limit:
      "This report contains more findings than automatic extraction can accept.",
    attempts_exhausted: "Processing stopped after repeated interruptions.",
  };
  return (
    reasons[report.extractionError ?? ""] ??
    "Automatic extraction could not finish."
  );
}
