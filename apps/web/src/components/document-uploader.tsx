'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Badge, Card, Notice, Spinner } from '@/components/primitives';

const MAX_UPLOAD_MB = 25;

export interface UploadedDocumentView {
  id: string;
  originalFilename: string;
  contentType: string;
  scanStatus: 'pending' | 'clean' | 'infected' | 'scanner_unavailable';
  patientTypeTag: string | null;
}

/**
 * Adding prior reports.
 *
 * The patient's own type and date tags are captured before the file is sent, not after — they are
 * what makes an unreadable scan still useful to the doctor, and asking for them after an
 * extraction failure would mean asking exactly when the patient has been told something went
 * wrong.
 */
export function DocumentUploader({
  caseId,
  editable,
  initial,
}: {
  caseId: string;
  editable: boolean;
  initial: UploadedDocumentView[];
}) {
  const t = useTranslations('documents');
  const tAll = useTranslations();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState(initial);
  const [typeTag, setTypeTag] = useState('');
  const [dateTag, setDateTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setProblem(null);

    const form = new FormData();
    form.set('file', file);
    if (typeTag !== '') form.set('patientTypeTag', typeTag);
    if (dateTag !== '') form.set('patientDateTag', dateTag);

    const result = await api.upload<{ document: UploadedDocumentView; pendingScan: boolean }>(
      `/api/cases/${caseId}/documents`,
      form,
    );
    setUploading(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }

    setDocuments((current) => [
      ...current,
      { ...result.data.document, patientTypeTag: typeTag === '' ? null : typeTag },
    ]);
    setTypeTag('');
    setDateTag('');
    if (fileInput.current !== null) fileInput.current.value = '';
    router.refresh();
  }

  async function remove(documentId: string) {
    const result = await api.del(`/api/cases/${caseId}/documents/${documentId}`);
    if (result.ok) {
      setDocuments((current) => current.filter((entry) => entry.id !== documentId));
    } else {
      setProblem(result.problem);
    }
  }

  return (
    <div>
      {editable && (
        <Card className="mb-6">
          <div className="mb-4">
            <label className="gi-label" htmlFor="type-tag">
              {t('typeTag')}
            </label>
            <input
              id="type-tag"
              className="gi-input"
              value={typeTag}
              onChange={(event) => setTypeTag(event.target.value)}
            />
            <p className="gi-hint">{t('typeTagHint')}</p>
          </div>

          <div className="mb-5">
            <label className="gi-label" htmlFor="date-tag">
              {t('dateTag')}
            </label>
            <input
              id="date-tag"
              type="date"
              className="gi-input max-w-[14rem]"
              value={dateTag}
              onChange={(event) => setDateTag(event.target.value)}
            />
          </div>

          <label className="gi-label" htmlFor="file">
            {t('chooseFile')}
          </label>
          <input
            id="file"
            ref={fileInput}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png"
            className="gi-input"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void upload(file);
            }}
          />
          <p className="gi-hint">{t('accepted', { maxMb: MAX_UPLOAD_MB })}</p>

          {uploading && (
            <p className="mt-3">
              <Spinner label={t('uploading')} />
            </p>
          )}
        </Card>
      )}

      {problem !== null && (
        <div className="mb-5">
          <Notice tone="emergency" role="alert">
            {tAll(problem.messageKey as never)}
          </Notice>
        </div>
      )}

      {documents.length === 0 ? (
        <p className="text-ink-muted">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {documents.map((document) => (
            <Card key={document.id} as="li">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{document.originalFilename}</p>
                  {document.patientTypeTag !== null && (
                    <p className="text-sm text-ink-muted">{document.patientTypeTag}</p>
                  )}
                </div>

                {document.scanStatus === 'clean' ? (
                  <Badge tone="ok">{t('uploaded')}</Badge>
                ) : (
                  <Badge tone="urgent">{t('scanPending')}</Badge>
                )}
              </div>

              {document.scanStatus !== 'clean' && (
                <p className="gi-hint">{t('scanPendingHint')}</p>
              )}

              {editable && (
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-emergency underline underline-offset-4"
                  onClick={() => {
                    if (window.confirm(t('removeConfirm'))) void remove(document.id);
                  }}
                >
                  {t('remove')}
                </button>
              )}
            </Card>
          ))}
        </ul>
      )}

      {!editable && (
        <p className="mt-5 text-sm text-ink-muted">{t('cannotDeleteAfterSubmit')}</p>
      )}
    </div>
  );
}
