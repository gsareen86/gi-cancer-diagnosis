"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { evaluate, urgencyNames, type Intake } from "@/lib/demo/clinical";
import type { QueueItem } from "@/lib/demo/types";
import { action } from "./shared";
import { Icon } from "@/components/ui";
function priority(i: QueueItem) {
  if (!i.contentVersion) return "unavailable";
  let floor;
  try {
    floor = evaluate(
      (i.intake as Intake).answers ?? {},
      i.contentVersion,
    ).urgency;
  } catch {
    return "unavailable";
  }
  const ranks = ["review", "prompt", "immediate"];
  return i.aiUrgency && ranks.indexOf(i.aiUrgency) > ranks.indexOf(floor)
    ? i.aiUrgency
    : floor;
}
export function DemoQueue({
  site,
  initialFilter = "open",
}: {
  site: string;
  initialFilter?: string;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState(0);
  const load = useCallback(async () => {
    try {
      const data = await action<QueueItem[]>("queue", site);
      setItems(data);
      setRefreshedAt(Date.now());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [site]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);
  const active = items.filter((i) => i.status !== "reviewed");
  const incomplete = (i: QueueItem) =>
    ["intake", "awaiting_consent"].includes(i.status);
  const urgent = active.filter((i) => priority(i) === "immediate");
  const shown = items
    .filter(
      (i) =>
        (filter === "incomplete"
          ? incomplete(i)
          : filter === "all" ||
            (filter === "reviewed"
              ? i.status === "reviewed"
              : i.status !== "reviewed")) &&
        `${i.name} ${i.id}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const rank = (v: QueueItem) =>
        ({ review: 0, prompt: 1, immediate: 2, unavailable: 3 })[priority(v)];
      return rank(b) - rank(a);
    });
  return (
    <section className="queue-section" aria-busy={loading}>
      <div className="metric-grid">
        <div>
          <span className="icon-circle danger">
            <Icon name="alert" size={28} />
          </span>
          <div>
            <strong>{loading ? "—" : urgent.length}</strong>
            <span>Immediate assistance</span>
          </div>
        </div>
        <div>
          <span className="icon-circle amber">
            <Icon name="clock" size={28} />
          </span>
          <div>
            <strong>
              {loading ? "—" : active.filter((i) => !incomplete(i)).length}
            </strong>
            <span>Awaiting review</span>
          </div>
        </div>
        <div>
          <span className="icon-circle neutral">
            <Icon name="document" size={28} />
          </span>
          <div>
            <strong>{loading ? "—" : active.filter(incomplete).length}</strong>
            <span>Incomplete intakes</span>
          </div>
        </div>
      </div>
      {urgent.length > 0 && (
        <div className="queue-urgent">
          <Icon name="alert" size={30} />
          <div>
            <strong>
              {urgent.length} visit{urgent.length > 1 ? "s" : ""} need immediate
              assistance
            </strong>
            <p>Open the visit and arrange clinical assistance.</p>
          </div>
          <Link
            className="button secondary"
            href={`/staff/demo/${urgent[0].id}`}
          >
            Open visit <Icon name="arrow" size={17} />
          </Link>
        </div>
      )}
      <div className="queue-toolbar">
        <div className="queue-filters" aria-label="Queue views">
          {[
            ["open", "All active", active.length],
            [
              "incomplete",
              "Needs information",
              active.filter(incomplete).length,
            ],
            ["reviewed", "Reviewed", items.length - active.length],
          ].map(([value, label, count]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(String(value))}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <div className="queue-tools">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search encounters"
              placeholder="Search name or encounter ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            className="secondary icon-button"
            aria-label="Refresh queue"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <Icon name="refresh" />
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="queue-table-wrap">
        <table className="queue-table">
          <thead>
            <tr>
              <th>Patient / encounter</th>
              <th>Intake</th>
              <th>Care priority</th>
              <th>Reports</th>
              <th>Assigned to</th>
              <th>Time open</th>
              <th>
                <span className="sr-only">Open visit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id}>
                <td data-label="Patient">
                  <Link className="patient-name" href={`/staff/demo/${i.id}`}>
                    {i.name || "Awaiting intake"}
                  </Link>
                  <small>
                    {i.age ? `${i.age} years · ` : ""}
                    {i.id.slice(0, 8).toUpperCase()}
                  </small>
                </td>
                <td data-label="Intake">
                  <span
                    className={`status-dot ${incomplete(i) ? "incomplete" : ""}`}
                  />
                  {i.status === "reviewed"
                    ? "Reviewed"
                    : incomplete(i)
                      ? "Incomplete"
                      : "Complete"}
                  <small>
                    {i.aiAvailable
                      ? "AI ready"
                      : i.aiOutdated
                        ? "AI needs refresh"
                        : "AI pending / unavailable"}
                  </small>
                </td>
                <td data-label="Care priority">
                  <span className={`priority ${priority(i)}`}>
                    <Icon
                      name={priority(i) === "immediate" ? "alert" : "clock"}
                      size={18}
                    />
                    {priority(i) === "unavailable"
                      ? "Priority unavailable — open visit"
                      : urgencyNames[priority(i) as keyof typeof urgencyNames]}
                  </span>
                </td>
                <td data-label="Reports">
                  {i.reportCount === undefined
                    ? "Open to view"
                    : i.reportCount === 0
                      ? "None"
                      : i.unverifiedReports
                        ? `${i.unverifiedReports} to verify`
                        : "Verified"}
                </td>
                <td data-label="Assigned to">
                  {i.assignedName ||
                    `Clinician · ${i.assignedTo.slice(0, 6).toUpperCase()}`}
                </td>
                <td data-label="Time open">
                  {Math.max(
                    0,
                    Math.floor(
                      (refreshedAt - Date.parse(i.createdAt ?? i.updatedAt)) /
                        60000,
                    ),
                  )}{" "}
                  min
                </td>
                <td>
                  <Link
                    className="row-open"
                    aria-label={`Open encounter ${i.name || i.id}`}
                    href={`/staff/demo/${i.id}`}
                  >
                    <Icon name="arrow" size={19} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !items.length && (
          <div className="empty-state">
            <span className="loading-ring" />
            <h3>Loading your review queue</h3>
          </div>
        )}
        {!shown.length && !loading && !error && (
          <div className="empty-state">
            <span className="icon-circle">
              <Icon name="document" size={28} />
            </span>
            <h3>{search ? "No matching visits" : "No visits in this view"}</h3>
            <p>
              {search
                ? "Try another name or encounter ID."
                : "New encounters will appear here when a visit is started."}
            </p>
          </div>
        )}
      </div>
      <p className="queue-footnote">
        <Icon name="lock" size={18} /> AI conclusions stay hidden until you save
        your independent assessment.
      </p>
    </section>
  );
}
export function PatientLauncher({ patient }: { patient: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      const e = await action<{ id: string }>("create", patient);
      router.push(`/staff/demo/${e.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => void start()}
      >
        Start new encounter
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
