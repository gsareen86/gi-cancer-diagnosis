import { rpc } from "@/lib/rpc";
import Link from "next/link";
import { cookies } from "next/headers";
import { requireStaff } from "@/lib/staff";
import { auditQuery } from "@/lib/audit-query";
type Membership = { site_id: string; site_name: string; role: string };
type AuditEvent = {
  id: string;
  occurred_at: string;
  action: string;
  outcome: string;
  actor_role: string | null;
  actor_user_id: string | null;
  purpose: string;
  record_ids: string[];
  request_id: string;
};
type Member = { user_id: string; role: string; active: boolean };
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await requireStaff();
  const membershipsResult = await rpc(client, "my_memberships");
  const memberships: Membership[] = membershipsResult.data?.ok
    ? membershipsResult.data.data
    : [];
  const selected =
    (await cookies()).get("gi-site")?.value ?? memberships[0]?.site_id;
  const membership = memberships.find(
    (m) => m.site_id === selected && m.role === "site_admin",
  );
  if (!membership)
    return (
      <main id="main" className="container">
        <Link href="/staff">Back to workspace</Link>
        <h1>Administration unavailable</h1>
        <p>Site-admin membership is required for the active site.</p>
      </main>
    );
  const query = auditQuery(await searchParams);
  if (!query.valid)
    return (
      <main id="main" className="container">
        <h1>Check the dates</h1>
        <p>Choose an ordered range of no more than 90 days.</p>
        <Link href="/staff/audit">Reset filters</Link>
      </main>
    );
  const pageLink = (page: number, members: number) =>
    `/staff/audit?${new URLSearchParams({ from: query.startDay, to: query.endDay, page: String(page), members: String(members) })}`;
  const [audit, members] = await Promise.all([
    rpc(client, "list_audit_events", {
      p_site: membership.site_id,
      p_from: query.start,
      p_to: query.end,
      p_offset: query.page * 50,
      p_purpose: "audit_review",
    }),
    rpc(client, "list_site_memberships", {
      p_site: membership.site_id,
      p_purpose: "site_administration",
      p_offset: query.memberPage * 50,
    }),
  ]);
  const events: AuditEvent[] = audit.data?.ok ? audit.data.data : [];
  const staff: Member[] = members.data?.ok ? members.data.data : [];
  return (
    <main id="main" className="container">
      <header className="topbar">
        <Link className="brand" href="/staff">
          GI Compass · Workspace
        </Link>
        <span>{membership.site_name}</span>
      </header>
      <section className="stack" style={{ paddingTop: 32 }}>
        <h1 style={{ fontSize: "2rem" }}>Site administration</h1>
        <form className="actions">
          <div>
            <label htmlFor="from">From (India time)</label>
            <input
              type="date"
              name="from"
              id="from"
              defaultValue={query.startDay}
              required
            />
          </div>
          <div>
            <label htmlFor="to">To (India time)</label>
            <input
              type="date"
              name="to"
              id="to"
              defaultValue={query.endDay}
              required
            />
          </div>
          <button>Apply dates</button>
        </form>
        <div className="panel">
          <h2>Memberships</h2>
          {members.error || !members.data?.ok ? (
            <p role="alert" className="error">
              Memberships could not be retrieved.
            </p>
          ) : (
            <div className="rows">
              {!staff.length && <p>No memberships on this page.</p>}
              {staff.map((member) => (
                <div className="row" key={`${member.user_id}-${member.role}`}>
                  <span className="code">{member.user_id}</span>
                  <span>
                    {member.role} · {member.active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <nav className="actions" aria-label="Membership pages">
          {query.memberPage > 0 && (
            <Link href={pageLink(query.page, query.memberPage - 1)}>
              Previous memberships
            </Link>
          )}
          {staff.length === 50 && (
            <Link href={pageLink(query.page, query.memberPage + 1)}>
              Next memberships
            </Link>
          )}
        </nav>
        <div className="panel">
          <h2>Access log</h2>
          <p className="muted">
            Up to 50 events per page, shown in India time. This review is also
            recorded.
          </p>
          {audit.error || !audit.data?.ok ? (
            <p role="alert" className="error">
              Audit entries could not be retrieved.
            </p>
          ) : (
            <div className="rows">
              {events.length ? (
                events.map((event) => (
                  <article className="row" key={event.id}>
                    <div>
                      <strong>{event.action}</strong>
                      <div>
                        {event.actor_role ?? "No applicable role"} ·{" "}
                        {event.outcome}
                      </div>
                      <small className="code">Request {event.request_id}</small>
                      <details>
                        <summary>Access details</summary>
                        <div className="code">
                          Actor: {event.actor_user_id ?? "Unavailable"}
                        </div>
                        <div>Purpose: {event.purpose}</div>
                        <div>Records: {event.record_ids.length}</div>
                        {event.record_ids.map((id) => (
                          <div className="code" key={id}>
                            {id}
                          </div>
                        ))}
                      </details>
                    </div>
                    <time dateTime={event.occurred_at}>
                      {new Date(event.occurred_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </time>
                  </article>
                ))
              ) : (
                <p>No entries in this period.</p>
              )}
            </div>
          )}
        </div>
        <nav className="actions" aria-label="Audit pages">
          {query.page > 0 && (
            <Link href={pageLink(query.page - 1, query.memberPage)}>
              Previous events
            </Link>
          )}
          {events.length === 50 && (
            <Link href={pageLink(query.page + 1, query.memberPage)}>
              Next events
            </Link>
          )}
        </nav>
      </section>
    </main>
  );
}
