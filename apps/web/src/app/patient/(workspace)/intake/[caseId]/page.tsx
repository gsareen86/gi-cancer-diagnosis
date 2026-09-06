import { redirect } from 'next/navigation';
import { IntakeWizard } from '@/components/patient/intake-wizard';
import { buildInterviewView } from '@/server/services/interview-service';
import { clinical } from '@/server/db';
import { ageInYears } from '@/server/services/age';
import { requireWorkspace } from '@/lib/guard';

/**
 * The interview is server-rendered on first load and takes over on the client from there.
 *
 * That first paint matters: a patient on a slow connection sees their question immediately rather
 * than a spinner while a bundle downloads, and the reference images load behind it.
 *
 * The uploaded documents are fetched here too, so the wizard's report stage has them without a
 * second round trip when the patient reaches it.
 */
export default async function IntakePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const user = await requireWorkspace('patient');

  const context = {
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing' as const,
  };

  const repo = clinical();
  const caseRecord = await repo.getCase(context, caseId);
  if (caseRecord === null) redirect('/patient/records');
  if (caseRecord.status !== 'in_progress') redirect(`/patient/case/${caseId}`);

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

  const documents = await repo.listDocuments(context, caseId);

  return (
    <IntakeWizard
      caseId={caseId}
      // Serialized so Maps and Dates cross the server/client boundary as plain data.
      initialView={JSON.parse(JSON.stringify(view)) as typeof view}
      hasEmergencyContact={user.hasEmergencyContact}
      documents={documents.map((document) => ({
        id: document.id,
        originalFilename: document.originalFilename,
        contentType: document.contentType,
        scanStatus: document.scanStatus,
        patientTypeTag: document.patientTypeTag,
      }))}
    />
  );
}
