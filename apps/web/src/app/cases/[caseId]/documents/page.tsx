import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/primitives';
import { DocumentUploader } from '@/components/document-uploader';
import { clinical } from '@/server/db';
import { currentUser } from '@/lib/session';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const t = await getTranslations('documents');
  const user = await currentUser();
  if (user === null) redirect('/login');

  const context = {
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing' as const,
  };

  const caseRecord = await clinical().getCase(context, caseId);
  if (caseRecord === null) redirect('/cases');

  const documents = await clinical().listDocuments(context, caseId);

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading lead={t('intro')}>{t('heading')}</PageHeading>
      <DocumentUploader
        caseId={caseId}
        editable={caseRecord.status === 'in_progress'}
        initial={documents.map((document) => ({
          id: document.id,
          originalFilename: document.originalFilename,
          contentType: document.contentType,
          scanStatus: document.scanStatus,
          patientTypeTag: document.patientTypeTag,
        }))}
      />
    </div>
  );
}
