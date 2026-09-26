import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { verifiedDeployment } from "@/lib/staff";
import { AuthShell } from "@/components/auth-shell";
import { Icon } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{
    revocation?: string;
    expired?: string;
    signedout?: string;
  }>;
}) {
  const query = await searchParams;
  if (query.signedout === "1" && query.revocation !== "pending")
    return (
      <AuthShell
        title="Signed out"
        description="Return to your clinic workspace."
        centered
      >
        <span className="icon-circle large">
          <Icon name="lock" size={36} />
        </span>
        <h1>You&apos;re signed out</h1>
        <p>
          Your session has ended. Sign in again to access the clinic workspace.
        </p>
        <Link className="button" href="/sign-in">
          Sign in again
        </Link>
        <p className="muted" style={{ marginTop: 24 }}>
          You can now close this window.
        </p>
      </AuthShell>
    );
  const ready = await verifiedDeployment();
  return (
    <AuthShell
      title="Your clinical workspace"
      description="Review visits, assess patients and record the next steps in their care."
    >
      <h1>Staff sign in</h1>
      {query.revocation === "pending" && (
        <p role="status" className="notice">
          Content was cleared on this device. Server sign-out could not be
          confirmed; reconnect and contact your operator if this device may be
          compromised.
        </p>
      )}
      {query.expired === "1" && (
        <p role="status">Your session has ended. Sign in again to continue.</p>
      )}
      {ready ? (
        <>
          <p>Use your clinic staff account.</p>
          <AuthForm />
        </>
      ) : (
        <>
          <p className="notice">
            The designated Supabase Cloud project is not configured or could not
            be verified.
          </p>
          <Link href="/setup">View setup requirements</Link>
        </>
      )}
    </AuthShell>
  );
}
