import { redirect } from 'next/navigation';
import { Interview } from '@/components/questionnaire/interview';
import { buildInterviewView } from '@/server/services/interview-service';
import { clinical } from '@/server/db';
import { ageInYears } from '@/server/services/age';
import { currentUser } from '@/lib/session';

/**
 * The interview is server-rendered on first load and takes over on the client from there.
 *
 * That first paint matters: a patient on a slow connection sees their question immediately rather
 * than a spinner while a bundle downloads, and the reference images load behind it.
 */
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const user = await currentUser();
  if (user === null) redirect('/login');

  const context = {
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing' as const,
  };

  const caseRecord = await clinical().getCase(context, caseId);
  if (caseRecord === null) redirect('/cases');
  if (caseRecord.status !== 'in_progress') redirect(`/cases/${caseId}`);

  const view = await buildInterviewView({
    context,
    caseRecord: {
      id: caseRecord.id,
      status: caseRecord.status,
      templateVersionId: caseRecord.templateVersionId,
      entryPointId: caseRecord.entryPointId,
      patientId: caseRecord.patientId,
    },
    locale: user.locale,
    ageYears: ageInYears(user.dateOfBirth),
  });

  return (
    <Interview
      caseId={caseId}
      // Serialized so Maps and Dates cross the server/client boundary as plain data.
      initialView={JSON.parse(JSON.stringify(view)) as typeof view}
      hasEmergencyContact={user.hasEmergencyContact}
    />
  );
}
