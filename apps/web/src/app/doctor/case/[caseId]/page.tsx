import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { CaseWorkspace } from '@/components/doctor/case-workspace';
import type { CaseWorkspaceData } from '@/components/doctor/types';
import { requireWorkspace } from '@/lib/guard';

/**
 * The doctor's case view.
 *
 * Fetched through the API rather than assembled here, so the exact authorization, consent, and
 * audit path a client would take is the one the page takes too — a server component that read
 * the repository directly would be a second code path with its own chance of drifting.
 *
 * The role and second-factor checks live in `app/doctor/layout.tsx` and have already run.
 */
export default async function DoctorCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  await requireWorkspace('doctor');

  const headerList = await headers();
  const cookie = headerList.get('cookie') ?? '';
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol = headerList.get('x-forwarded-proto') ?? 'http';

  const response = await fetch(`${protocol}://${host}/api/doctor/cases/${caseId}`, {
    headers: { cookie },
    cache: 'no-store',
  });

  // A case this doctor may not read is indistinguishable from one that does not exist, which is
  // what the repository's `notFound` flag is for. Either way they land back on the queue.
  if (!response.ok) redirect('/doctor/triage');
  const data = (await response.json()) as CaseWorkspaceData;

  return <CaseWorkspace caseId={caseId} data={data} />;
}
