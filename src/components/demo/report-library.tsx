"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import type { Evidence } from "@/lib/demo/clinical";
import type { DemoReport, Encounter } from "@/lib/demo/types";
import { action } from "./shared";
import { PdfViewer } from "./pdf-viewer";
import {
  canRetryReport,
  reportStatus,
  reportInterrupted,
  reportFailureReason,
} from "@/lib/demo/report-status";
type ReportChange = {
  reason: "refresh" | "upload" | "remove" | "retry" | "verification";
  sourceVersion: number;
};
export function ReportLibrary({
  encounter,
  patient,
  onChange,
}: {
  encounter: Encounter;
  patient: boolean;
  onChange?: (e: Encounter, change: ReportChange) => void;
}) {
  const [selected, setSelected] = useState<DemoReport | null>(null),
    [fields, setFields] = useState<Evidence[]>([]),
    [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const canVerify =
    !patient &&
    !!onChange &&
    encounter.status !== "reviewed" &&
    selected?.extractionStatus !== "running" &&
    selected?.extractionStatus !== "queued";
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const processing = encounter.reports.some((r) =>
    ["queued", "running"].includes(r.extractionStatus ?? ""),
  );
  useEffect(() => {
    if (!processing || !onChange) return;
    const timer = setInterval(() => {
      void action("get", encounter.id, {}, patient)
        .then((e) => {
          onChange(e, { reason: "refresh", sourceVersion: encounter.version });
          const fresh = e.reports.find((r) => r.id === selected?.id);
          if (
            fresh &&
            ["queued", "running"].includes(selected?.extractionStatus ?? "")
          ) {
            setSelected(fresh);
            if (!["queued", "running"].includes(fresh.extractionStatus ?? ""))
              setFields(fresh.fields);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [
    processing,
    encounter.id,
    encounter.version,
    patient,
    onChange,
    selected,
  ]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function open(report: DemoReport) {
    await run(async () => {
      const response = await fetch("/api/demo/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: encounter.id,
          reportId: report.id,
          patient,
        }),
      });
      if (!response.ok)
        throw new Error("The original report could not be opened.");
      setUrl(URL.createObjectURL(await response.blob()));
      setSelected(report);
      setFields(report.fields);
    });
  }
  async function upload(file: File) {
    await run(async () => {
      const form = new FormData();
      form.append("file", file);
      form.append("encounterId", encounter.id);
      const response = await fetch("/api/demo/report", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onChange?.(result.data, {
        reason: "upload",
        sourceVersion: encounter.version,
      });
      setSelected(null);
      setUrl("");
    });
  }
  function update(index: number, patch: Partial<Evidence>) {
    setFields((current) =>
      current.map((f, i) =>
        i === index
          ? Object.keys(patch).every((key) => key === "rejected")
            ? { ...f, ...patch }
            : {
                ...f,
                ...patch,
                verified: false,
                confidence: "manual-transcription",
              }
          : f,
      ),
    );
  }
  async function retry(report: DemoReport) {
    await run(async () => {
      const updated = await action("report_retry", encounter.id, {
        reportId: report.id,
      });
      onChange?.(updated, {
        reason: "retry",
        sourceVersion: encounter.version,
      });
      if (selected?.id === report.id) {
        setSelected(updated.reports.find((r) => r.id === report.id) ?? null);
        setFields([]);
      }
    });
  }
  return (
    <section className="stack report-library">
      <header>
        <p className="eyebrow">Optional reports</p>
        <h2>Bring your reports into the conversation</h2>
        <p>
          Add existing blood tests, radiology reports, endoscopy or biopsy
          reports. You can continue without them.
        </p>
      </header>
      {patient && encounter.status === "intake" && (
        <div className="upload-layout">
          <div className="upload-zone">
            <span className="icon-circle">
              <Icon name="upload" size={28} />
            </span>
            <h3>Upload a report</h3>
            <label className="button secondary">
              Choose PDF or image
              <input
                className="sr-only"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="button secondary">
              Take a photo
              <input
                className="sr-only"
                type="file"
                capture="environment"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <small>
              PDF, PNG or JPEG · Up to 5 MB and 30 pages per report · Up to 5
              reports
            </small>
          </div>
          <aside className="panel soft-panel">
            <h3>A clear page helps</h3>
            <ul>
              <li>Include the whole page, with the report date.</li>
              <li>Keep the page flat and avoid glare.</li>
              <li>
                Upload the written report for CT or MRI, rather than scan
                images.
              </li>
            </ul>
            <p className="info-note">
              <Icon name="person" />
              Extracted findings are used automatically in your preliminary AI
              assessment. Staff can review and correct them against the
              original.
            </p>
          </aside>
        </div>
      )}
      {busy && <p role="status">Saving or opening your report…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="report-list">
        {encounter.reports.map((r) => (
          <article className="report-row" key={r.id}>
            <Icon name="document" />
            <button
              className="link-button"
              disabled={busy}
              onClick={() => void open(r)}
            >
              {r.name}
            </button>
            <span className="source-chip" role="status">
              {reportStatus(r)}
            </span>
            {(r.extractionStatus === "failed" || reportInterrupted(r)) && (
              <div className="report-processing-notice">
                <p>
                  {patient
                    ? "Your original report is saved. Staff can retry processing or review it directly."
                    : `${reportFailureReason(r)} The original report is available for manual review.`}
                </p>
                {!patient &&
                  onChange &&
                  encounter.consentAt &&
                  encounter.status !== "reviewed" &&
                  canRetryReport(r) && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void retry(r)}
                      aria-label={`Retry processing ${r.name}`}
                    >
                      Retry processing
                    </button>
                  )}
              </div>
            )}
            {patient && encounter.status === "intake" && (
              <button
                className="link-button"
                disabled={busy}
                aria-label={`Remove ${r.name}`}
                onClick={() =>
                  void run(async () => {
                    onChange?.(
                      await action(
                        "report_remove",
                        encounter.id,
                        { reportId: r.id },
                        true,
                      ),
                      { reason: "remove", sourceVersion: encounter.version },
                    );
                    if (selected?.id === r.id) {
                      setSelected(null);
                      setUrl("");
                    }
                  })
                }
              >
                Remove
              </button>
            )}
          </article>
        ))}
      </div>
      {!encounter.reports.length && (
        <div className="empty-state">
          <Icon name="document" size={32} />
          <p>No reports added yet.</p>
        </div>
      )}
      {selected && (
        <div className="evidence-layout">
          <div className="panel original-report">
            <h3>Original report</h3>
            <p>{selected.name}</p>
            {url &&
              (selected.mime === "application/pdf" ? (
                <PdfViewer url={url} />
              ) : (
                // Authorised object URLs remain local; never send reports through an image optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Original report page" src={url} />
              ))}
            <a href={url} target="_blank" rel="noreferrer">
              Open original in a larger view
            </a>
          </div>
          <div className="panel">
            <p className="eyebrow">Source-linked findings</p>
            <h3>
              {patient
                ? "Report processing"
                : "Review or correct report findings"}
            </h3>
            <p role="status">{reportStatus(selected)}</p>
            <p>{selected.quality}</p>
            <p className="muted">
              Extracted findings are included automatically in preliminary AI
              assessment. Staff review is optional. Corrections and rejected
              findings are recorded with the reviewer and time. Confirm any
              manually entered correction against the original before including
              it.
            </p>
            {fields.map((f, i) => (
              <fieldset className="evidence-field" key={f.id}>
                <legend>
                  Page {f.page} ·{" "}
                  {f.confidence === "vision-extracted"
                    ? "Image extraction"
                    : f.confidence === "text-extracted"
                      ? "Text extraction"
                      : "Manual transcription"}
                </legend>
                <blockquote className="source-quote">{f.sourceText}</blockquote>
                {canVerify ? (
                  <>
                    <label>
                      Finding
                      <input
                        maxLength={120}
                        value={f.label}
                        onChange={(e) => update(i, { label: e.target.value })}
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Value as printed
                        <input
                          maxLength={500}
                          value={f.value}
                          onChange={(e) => update(i, { value: e.target.value })}
                        />
                      </label>
                      <label>
                        Unit
                        <input
                          maxLength={30}
                          value={f.unit}
                          onChange={(e) => update(i, { unit: e.target.value })}
                        />
                      </label>
                      <label>
                        Reference interval
                        <input
                          maxLength={200}
                          value={f.referenceRange ?? ""}
                          onChange={(e) =>
                            update(i, { referenceRange: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Report date
                        <input
                          maxLength={30}
                          value={f.date}
                          onChange={(e) => update(i, { date: e.target.value })}
                        />
                      </label>
                    </div>
                    {f.confidence === "manual-transcription" && (
                      <>
                        <label>
                          Source page
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={f.page}
                            onChange={(e) =>
                              update(i, { page: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          Exact source text
                          <textarea
                            value={f.sourceText}
                            maxLength={2000}
                            onChange={(e) =>
                              update(i, { sourceText: e.target.value })
                            }
                          />
                        </label>
                      </>
                    )}
                    <div className="actions">
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={f.verified && !f.rejected}
                          onChange={(e) =>
                            setFields((fs) =>
                              fs.map((x, n) =>
                                n === i
                                  ? {
                                      ...x,
                                      verified: e.target.checked,
                                      rejected: false,
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        Verified against original
                      </label>
                      <button
                        className="link-button"
                        onClick={() => update(i, { rejected: !f.rejected })}
                      >
                        {f.rejected ? "Restore proposal" : "Reject finding"}
                      </button>
                    </div>
                    {f.rejected && <p>Rejected · Excluded from analysis</p>}
                  </>
                ) : (
                  <>
                    <strong>
                      {f.label}: {f.value} {f.unit}
                    </strong>
                    <p>
                      {f.verified && !f.rejected
                        ? "Verified by staff"
                        : f.confidence === "manual-transcription"
                          ? "Manual finding awaiting confirmation"
                          : "Automatically extracted · Not reviewed by staff"}{" "}
                      · {f.date || "Date not printed"}
                    </p>
                  </>
                )}
              </fieldset>
            ))}
            {canVerify && (
              <div className="stack">
                <button
                  className="secondary"
                  onClick={() =>
                    setFields((fs) => [
                      ...fs,
                      {
                        id: `manual-${crypto.randomUUID()}`,
                        label: "",
                        value: "",
                        unit: "",
                        date: "",
                        sourceText: "",
                        page: 1,
                        verified: false,
                        confidence: "manual-transcription",
                      },
                    ])
                  }
                >
                  Add a finding from the original
                </button>
                {!fields.length && !selected.fields.length && (
                  <p className="muted">
                    Add a finding from the original before saving verification.
                  </p>
                )}
                <button
                  disabled={busy || (!fields.length && !selected.fields.length)}
                  onClick={() =>
                    void run(async () => {
                      const e = await action("report_verify", encounter.id, {
                        reportId: selected.id,
                        fields,
                        sourceVersion: encounter.version,
                      });
                      onChange?.(e, {
                        reason: "verification",
                        sourceVersion: encounter.version,
                      });
                      setSelected(
                        e.reports.find((r) => r.id === selected.id) ?? null,
                      );
                    })
                  }
                >
                  Save report corrections
                </button>
                <small>
                  Saving changed findings starts a new version and clears the
                  saved assessment for the previous facts. Unsaved entries stay
                  visible but cannot be signed until the new facts are reviewed.
                  Saving unchanged findings keeps your assessment.
                </small>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
