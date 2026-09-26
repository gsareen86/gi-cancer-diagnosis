import { rpc } from "@/lib/rpc";
import { requireStaff } from "@/lib/staff";
import { SessionBoundary } from "@/components/session-boundary";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = await requireStaff();
  const { data, error } = await rpc(client, "session_status");
  if (error || !data?.ok) redirect("/sign-in?expired=1");
  const expiry = Math.min(
    Date.parse(data.data.idleExpiresAt),
    Date.parse(data.data.absoluteExpiresAt),
  );
  if (!Number.isFinite(expiry) || expiry <= Date.now())
    redirect("/sign-in?expired=1");
  return (
    <SessionBoundary expiresAt={new Date(expiry).toISOString()}>
      {children}
    </SessionBoundary>
  );
}
