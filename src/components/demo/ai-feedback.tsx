"use client";
import { useState } from "react";
import type { Encounter } from "@/lib/demo/types";
import { action } from "./shared";
export const feedbackDimensions = [
  "Possible causes",
  "Evidence used",
  "Urgency",
  "Doctor type",
  "Suggested investigations",
  "Patient explanation",
] as const;
export function AIFeedback({ encounter }: { encounter: Encounter }) {
  const [overall, setOverall] = useState(""),
    [dimensions, setDimensions] = useState<Record<string, string>>({}),
    [issue, setIssue] = useState(""),
    [source, setSource] = useState(""),
    [notes, setNotes] = useState(""),
    [status, setStatus] = useState("");
  return (
    <form
      className="panel stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("Saving…");
        try {
          await action("feedback", encounter.id, {
            sourceVersion: encounter.version,
            overall,
            dimensions,
            issue,
            source,
            notes,
          });
          setStatus("Feedback saved.");
        } catch (e) {
          setStatus((e as Error).message);
        }
      }}
    >
      <p className="eyebrow">Optional quality feedback</p>
      <h2>How does the AI assessment compare?</h2>
      <p>Your feedback does not change the released patient plan.</p>
      <label>
        Overall assessment
        <select
          required
          value={overall}
          onChange={(e) => setOverall(e.target.value)}
        >
          <option value="">Select your assessment</option>
          {["Accept", "Needs changes", "Disagree", "Unable to assess"].map(
            (v) => (
              <option key={v}>{v}</option>
            ),
          )}
        </select>
      </label>
      <div className="feedback-grid">
        {feedbackDimensions.map((d) => (
          <label key={d}>
            {d}
            <select
              required
              aria-label={d}
              value={dimensions[d] ?? ""}
              onChange={(e) =>
                setDimensions((v) => ({ ...v, [d]: e.target.value }))
              }
            >
              <option value="">Select</option>
              {[
                "Appropriate",
                "Needs changes",
                "Incorrect",
                "Unable to assess",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label>
        Primary issue
        <select value={issue} onChange={(e) => setIssue(e.target.value)}>
          {[
            "",
            "No issue",
            "Missing information",
            "Unsupported interpretation",
            "Incorrect source",
            "Urgency mismatch",
            "Unclear explanation",
            "Other",
          ].map((v) => (
            <option key={v} value={v}>
              {v || "Select if applicable"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Affected source
        <input
          value={source}
          maxLength={200}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Question or report finding, if applicable"
        />
      </label>
      <label>
        Comments
        <textarea
          value={notes}
          maxLength={1500}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button disabled={!encounter.ai || status === "Saving…"}>
        Save AI feedback
      </button>
      <p role="status">{status}</p>
    </form>
  );
}
