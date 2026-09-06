import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PageHeading, Panel } from '@/components/primitives';
import { DocumentUploader } from '@/components/document-uploader';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { clinical } from '@/server/db';
import { requireWorkspace } from '@/lib/guard';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const t = await getTranslations('documents');
  const tApp = await getTranslations('app');
  const user = await requireWorkspace('patient');

  const context = {
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing' as const,
  };

  const repo = clinical();
  const caseRecord = await repo.getCase(context, caseId);
  if (caseRecord === null) redirect('/patient/records');

  const documents = await repo.listDocuments(context, caseId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/patient/case/${caseId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {tApp('back')}
      </Link>

      <PageHeading lead={t('intro')}>{t('heading')}</PageHeading>

      <Panel>
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
      </Panel>
    </div>
  );
}
