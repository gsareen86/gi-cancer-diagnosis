import { rpc } from "@/lib/rpc";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { DemoQueue, PatientLauncher } from "@/components/demo/queue";
type Membership = { site_id: string; site_name: string; role: string };
type Patient = {
  id: string;
  synthetic_identifier: string;
  display_name: string;
  year_of_birth: number | null;
};
export default async function Staff({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const query = await searchParams;
  const client = await requireStaff();
  const response = await rpc(client, "my_memberships");
  if (response.error || !response.data?.ok)
    return (
      <main id="main" className="container">
        <h1>Workspace unavailable</h1>
        <p>No records could be retrieved. Please try again.</p>
      </main>
    );
  const memberships: Membership[] = response.data.data;
  const requested = (await cookies()).get("gi-site")?.value;
  const site =
    memberships.find((m) => m.site_id === requested)?.site_id ??
    memberships[0]?.site_id;
  const current = memberships.filter((m) => m.site_id === site);
  const role = current.some((m) => m.role === "clinician")
    ? "clinician"
    : current.some((m) => m.role === "coordinator")
      ? "coordinator"
      : "site_admin";
  const result =
    site && role !== "site_admin"
      ? await rpc(client, "list_patients", {
          p_site: site,
          p_purpose: role === "clinician" ? "direct_care" : "intake_support",
        })
      : null;
  const patients: Patient[] = result?.data?.ok ? result.data.data : [];
  async function changeSite(form: FormData) {
    "use server";
    const active = await requireStaff();
    const result = await rpc(active, "my_memberships");
    const chosen = String(form.get("site"));
    if (
      result.data?.ok &&
      result.data.data.some((m: Membership) => m.site_id === chosen)
    ) {
      (await cookies()).set("gi-site", chosen, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.APP_ORIGIN?.startsWith("https:"),
        path: "/",
      });
    }
    redirect("/staff");
  }
  async function openPatient(form: FormData) {
    "use server";
    const active = await requireStaff();
    const selectedSite = String(form.get("site"));
    const patientId = String(form.get("patient"));
    const list = await rpc(active, "my_memberships");
    if (
      list.data?.ok &&
      list.data.data.some(
        (m: Membership) =>
          m.site_id === selectedSite &&
          ["clinician", "coordinator"].includes(m.role),
      ) &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(patientId)
    ) {
      const jar = await cookies();
      const options = {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.APP_ORIGIN?.startsWith("https:"),
        path: "/",
        maxAge: 900,
      };
      jar.set("gi-site", selectedSite, options);
      jar.set("gi-patient", patientId, options);
      redirect("/staff/patient");
    }
    redirect("/staff");
  }
  const sites = [
    ...new Map(memberships.map((m) => [m.site_id, m.site_name])).entries(),
  ];
  return (
    <main id="main" className="clinic-page">
      <div className="clinic-topline">
        <form action={changeSite} className="site-switcher">
          <label htmlFor="site">Active site</label>
          <select
            id="site"
            name="site"
            defaultValue={site}
            disabled={!sites.length}
          >
            {sites.map(([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </select>
          <button className="secondary" disabled={!sites.length}>
            Change site
          </button>
        </form>
        {current.some((m) => m.role === "site_admin") && (
          <Link href="/staff/audit">Audit and memberships</Link>
        )}
      </div>
      <section>
        <div className="page-heading">
          <p className="eyebrow">{current[0]?.site_name ?? "No active site"}</p>
          <h1>
            {role === "site_admin"
              ? "Site administration"
              : query.view === "reviewed"
                ? "Reviewed visits"
                : "Review queue"}
          </h1>
          <p>Every visit stays assigned until a clinician completes review.</p>
        </div>
        {site && role !== "site_admin" && (
          <DemoQueue
            key={query.view ?? "open"}
            site={site}
            initialFilter={query.view === "reviewed" ? "reviewed" : "open"}
          />
        )}
        {!memberships.length ? (
          <p className="notice">
            No active memberships. Contact your operator for access.
          </p>
        ) : role === "site_admin" ? (
          <p>
            Use the audit and memberships view to administer this site. This
            role does not grant patient access.
          </p>
        ) : result?.error || !result?.data?.ok ? (
          <p role="alert" className="error">
            The patient list is unavailable. No records were returned.
          </p>
        ) : (
          <details className="patient-directory" id="patient-directory">
            <summary>
              Patient directory <span>Start a new encounter</span>
            </summary>
            <div className="rows">
              {patients.length ? (
                patients.map((patient) => (
                  <article className="row" key={patient.id}>
                    <div>
                      <strong>{patient.display_name}</strong>
                      <div className="muted">
                        {patient.synthetic_identifier}
                      </div>
                    </div>
                    <span>Year of birth: {patient.year_of_birth ?? "Not supplied"}</span>
                    <PatientLauncher patient={patient.id} />
                    <form action={openPatient}>
                      <input type="hidden" name="site" value={site} />
                      <input type="hidden" name="patient" value={patient.id} />
                      <button className="secondary">View record</button>
                    </form>
                  </article>
                ))
              ) : (
                <p>No patients at this site.</p>
              )}
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
