import { rpc } from "@/lib/rpc";
import Link from "next/link";
import { cookies } from "next/headers";
import { requireStaff } from "@/lib/staff";
import { demoRpc } from "@/lib/demo/server";
import { redirect } from "next/navigation";
import { PatientLauncher } from "@/components/demo/queue";

export default async function PatientPage() {
  const client = await requireStaff();
  const jar = await cookies();
  const site = jar.get("gi-site")?.value;
  const patient = jar.get("gi-patient")?.value;
  const memberships = await rpc(client, "my_memberships");
  const current = memberships.data?.ok
    ? memberships.data.data.filter(
        (m: { site_id: string }) => m.site_id === site,
      )
    : [];
  const purpose = current.some((m: { role: string }) => m.role === "clinician")
    ? "direct_care"
    : "intake_support";
  const result =
    site && patient
      ? await rpc(client, "get_patient", {
          p_site: site,
          p_id: patient,
          p_purpose: purpose,
        })
      : null;
  const data = result?.data?.ok ? result.data.data[0] : null;
  if (data) {
    const encounter = (await demoRpc("for_patient", data.id).catch(
      () => null,
    )) as { id?: string } | null;
    if (encounter?.id) redirect(`/staff/demo/${encounter.id}`);
  }
  return (
    <main id="main" className="container">
      <Link href="/staff">Back to workspace</Link>
      <section className="panel" style={{ marginTop: 24 }}>
        <p className="eyebrow">Patient record</p>
        <h1 style={{ fontSize: "2rem" }}>
          {data ? data.display_name : "Record unavailable"}
        </h1>
        {data ? (
          <>
            <p>{data.synthetic_identifier}</p>
            <p>Year of birth: {data.year_of_birth ?? "Not supplied"}</p>
            <p>
              Start an encounter to open the consent, questionnaire, optional
              reports and clinician review journey.
            </p>
            <PatientLauncher patient={data.id} />
          </>
        ) : (
          <p>
            The record could not be retrieved for your current site and role.
          </p>
        )}
      </section>
    </main>
  );
}
