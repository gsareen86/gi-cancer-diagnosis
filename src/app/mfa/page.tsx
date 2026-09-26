import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaForm } from "@/components/mfa-form";
import { verifiedDeployment } from "@/lib/staff";
import { AuthShell } from "@/components/auth-shell";
export const dynamic = "force-dynamic";
export default async function Mfa() {
  const client = await verifiedDeployment();
  if (!client) redirect("/setup");
  const { data } = await client.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");
  return (
    <AuthShell
      title="One more step to your workspace"
      description="Verify that it is you before opening clinic records."
    >
      <h1 style={{ fontSize: "2rem" }}>Verify your identity</h1>
      <p>A second factor is required before accessing clinic records.</p>
      <MfaForm />
      <p>
        <Link href="/sign-in">Return to sign in</Link>
      </p>
    </AuthShell>
  );
}
