import { ClinicianWorkspace } from "@/components/demo/clinician-workspace";
import { requireStaff } from "@/lib/staff";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  return <ClinicianWorkspace id={id} />;
}
