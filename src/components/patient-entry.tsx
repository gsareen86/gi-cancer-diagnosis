"use client";
import { useState } from "react";
import Link from "next/link";
import { Brand, Icon } from "./ui";
export function PatientEntry({
  slug,
  demo = false,
}: {
  slug: string;
  demo?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main id="main" className="patient-container">
      <header className="patient-header">
        <Brand />
        <Link href="/sign-in">Staff sign in</Link>
      </header>
      <div className="entry-layout">
        <section>
          <p className="eyebrow">Welcome to GI Compass</p>
          <h1>
            A clearer path
            <br />
            to the care you need.
          </h1>
          <p className="lead">
            Tell us what has been happening, add any reports you have, and
            prepare for your consultation.
          </p>
          <div className="entry-benefits">
            <p>
              <Icon name="document" /> Answer at your own pace
            </p>
            <p>
              <Icon name="spark" /> Understand your preliminary AI assessment
            </p>
            <p>
              <Icon name="person" /> Review your next steps with a clinician
            </p>
          </div>
        </section>
        <section className="panel entry-card">
          <span className="icon-circle">
            <Icon name="person" size={32} />
          </span>
          <h2>Start your visit</h2>
          <p>
            No account or sign-in needed. We’ll explain how your information is
            used before asking any health questions.
          </p>
          {demo && (
            <p className="notice">
              <strong>Demonstration</strong> — use fictional information and the
              supplied sample reports.
            </p>
          )}
          <button
            disabled={busy || !slug}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/patient/start", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ slug }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                window.location.assign(result.next);
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {busy ? "Opening your visit…" : "Begin questionnaire"}
            <Icon name="arrow" />
          </button>
          {!slug && <p>Use the clinic’s QR code or visit link to begin.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p className="muted">
            <Icon name="lock" size={16} /> Your visit stays private to your care
            team.
          </p>
          <Link href="/patient">Resume an existing visit</Link>
        </section>
      </div>
      <aside className="notice">
        <strong>Need medical help now?</strong>
        <p>
          If you feel seriously unwell, seek immediate medical assistance or
          tell clinic staff. Do not wait to complete this questionnaire.
        </p>
      </aside>
    </main>
  );
}
