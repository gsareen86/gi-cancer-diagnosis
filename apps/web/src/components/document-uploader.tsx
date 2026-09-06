'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Field, Notice } from '@/components/primitives';
import { EmptyState, StatusChip } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { FileIcon, TrashIcon, UploadIcon } from '@/components/ui/icons';

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
 * Drag-and-drop *and* a file picker, never drag-and-drop alone: dropping a file requires a
 * pointer, a steady hand and a second window, and a patient on a phone has none of those. The
 * drop zone is an enhancement layered over a real `<input type="file">`, which stays keyboard
 * reachable and is what actually opens on tap.
 *
 * Progress comes from `XMLHttpRequest` rather than `fetch`, because `fetch` cannot report upload
 * progress and a 12MB endoscopy PDF on Indian mobile data takes long enough that a static
 * spinner reads as a hang.
 *
 * The patient's own type and date tags are captured before the file is sent, not after — they are
 * what makes an unreadable scan still useful to the doctor, and asking for them after an
 * extraction failure would mean asking exactly when the patient has been told something went
 * wrong.
 *
 * Each file in a batch reports its own outcome. One rejected file does not discard the others,
 * and the reason is stated against the file it belongs to.
 */

interface Pending {
  key: string;
  name: string;
  size: number;
  progress: number;
  /** A blob URL for images, so the patient can see they picked the right scan. */
  preview: string | null;
  problem: ApiProblem | null;
}

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.docx,.dcm,.dicom,application/pdf,image/jpeg,image/png,application/dicom';

export function DocumentUploader({
  caseId,
  editable,
  initial,
  onBusyChange,
}: {
  caseId: string;
  editable: boolean;
  initial: UploadedDocumentView[];
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useTranslations('documents');
  const tAll = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState(initial);
  const [typeTag, setTypeTag] = useState('');
  const [dateTag, setDateTag] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  // Blob URLs are revoked on unmount; leaving them alive holds the whole file in memory for as
  // long as the tab is open, which on a phone with four scans queued is a real cost.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => { onBusyChange?.(pending.some((entry) => entry.problem === null)); }, [pending, onBusyChange]);
  useEffect(
    () => () => {
      for (const entry of pendingRef.current) {
        if (entry.preview !== null) URL.revokeObjectURL(entry.preview);
      }
    },
    [],
  );

  const upload = useCallback(
    async (file: File, key: string) => {
      const form = new FormData();
      form.set('file', file);
      if (typeTag !== '') form.set('patientTypeTag', typeTag);
      if (dateTag !== '') form.set('patientDateTag', dateTag);

      const result = await uploadWithProgress<{
        document: UploadedDocumentView;
        pendingScan: boolean;
      }>(`/api/cases/${caseId}/documents`, form, (fraction) => {
        setPending((current) =>
          current.map((entry) => (entry.key === key ? { ...entry, progress: fraction } : entry)),
        );
      });

      if (!result.ok) {
        // Stays in the list with its reason attached, so a batch of four with one rejection shows
        // three successes and one explained failure rather than a single global error.
        setPending((current) =>
          current.map((entry) =>
            entry.key === key ? { ...entry, problem: result.problem, progress: 1 } : entry,
          ),
        );
        toast({ message: t('uploadFailed', { name: file.name }), tone: 'emergency' });
        return;
      }

      setDocuments((current) => [
        ...current,
        { ...result.data.document, patientTypeTag: typeTag === '' ? null : typeTag },
      ]);
      setPending((current) => {
        const done = current.find((entry) => entry.key === key);
        if (done?.preview != null) URL.revokeObjectURL(done.preview);
        return current.filter((entry) => entry.key !== key);
      });
      toast({ message: t('uploadSucceeded', { name: file.name }), tone: 'ok' });
      router.refresh();
    },
    [caseId, dateTag, typeTag, router, t, toast],
  );

  const accept = useCallback(
    (files: FileList | null) => {
      if (files === null || files.length === 0) return;
      setProblem(null);

      for (const file of Array.from(files)) {
        const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
        setPending((current) => [
          ...current,
          {
            key,
            name: file.name,
            size: file.size,
            progress: 0,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
            problem: null,
          },
        ]);
        void upload(file, key);
      }
      if (fileInput.current !== null) fileInput.current.value = '';
    },
    [upload],
  );

  async function remove(documentId: string, name: string) {
    const result = await api.del(`/api/cases/${caseId}/documents/${documentId}`);
    if (result.ok) {
      setDocuments((current) => current.filter((entry) => entry.id !== documentId));
      toast({ message: t('removed', { name }), tone: 'ok' });
    } else {
      setProblem(result.problem);
    }
  }

  return (
    <div>
      {editable && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('typeTag')} htmlFor="type-tag" hint={t('typeTagHint')}>
              <input
                id="type-tag"
                className="gi-input"
                value={typeTag}
                onChange={(event) => setTypeTag(event.target.value)}
              />
            </Field>

            <Field label={t('dateTag')} htmlFor="date-tag">
              <input
                id="date-tag"
                type="date"
                className="gi-input"
                value={dateTag}
                onChange={(event) => setDateTag(event.target.value)}
              />
            </Field>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              accept(event.dataTransfer.files);
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging
                ? 'border-accent bg-accent-faint'
                : 'border-line-strong bg-surface-sunken hover:border-accent-line'
            }`}
          >
            <span
              aria-hidden="true"
              className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-accent shadow-card"
            >
              <UploadIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 font-medium">{t('dropHere')}</p>
            <p className="mt-1 text-sm text-ink-muted">{t('accepted', { maxMb: MAX_UPLOAD_MB })}</p>

            {/*
              The real control. Visually hidden rather than `display: none`, so it keeps its place
              in the tab order and the label below activates it — dropping is the enhancement,
              this is the route that always works.
            */}
            <label htmlFor="file" className="gi-button-secondary mt-4 cursor-pointer">
              {t('chooseFile')}
            </label>
            <input
              id="file"
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPTED}
              className="sr-only"
              onChange={(event) => accept(event.target.files)}
            />
          </div>
        </>
      )}

      {pending.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pending.map((entry) => (
            <li
              key={entry.key}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                entry.problem === null ? 'border-line bg-surface' : 'border-emergency-line bg-emergency-faint'
              }`}
            >
              <Thumbnail preview={entry.preview} alt={t('previewOf', { name: entry.name })} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.name}</p>
                {entry.problem === null ? (
                  <>
                    <div
                      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(entry.progress * 100)}
                      aria-label={t('uploadingFile', { name: entry.name })}
                    >
                      <div
                        className="h-full rounded-full bg-accent-bright transition-[width]"
                        style={{ width: `${Math.round(entry.progress * 100)}%` }}
                      />
                    </div>
                    <p className="gi-numeric mt-1 text-2xs text-ink-faint">
                      {Math.round(entry.progress * 100)}%
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-emergency">
                    {tAll(entry.problem.messageKey as never)}
                  </p>
                )}
              </div>
              {entry.problem !== null && (
                <button
                  type="button"
                  className="gi-button-sm gi-button-ghost"
                  aria-label={t('dismissFailed', { name: entry.name })}
                  onClick={() =>
                    setPending((current) => current.filter((item) => item.key !== entry.key))
                  }
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {problem !== null && (
        <div className="mt-4">
          <Notice tone="emergency" role="alert">
            {tAll(problem.messageKey as never)}
          </Notice>
        </div>
      )}

      <div className="mt-6">
        <h3 className="gi-section-title">{t('uploadedHeading')}</h3>
        {documents.length === 0 ? (
          <EmptyState
            icon={<FileIcon className="h-5 w-5" />}
            title={t('emptyTitle')}
            body={t('empty')}
          />
        ) : (
          <ul className="mt-2 space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-inset text-ink-muted"
                >
                  <FileIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{document.originalFilename}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    {document.patientTypeTag !== null && (
                      <StatusChip tone="neutral" dot={false}>
                        {document.patientTypeTag}
                      </StatusChip>
                    )}
                    <StatusChip
                      tone={document.scanStatus === 'clean' ? 'ok' : 'caution'}
                      dot={false}
                    >
                      {document.scanStatus === 'clean' ? t('uploaded') : t('scanPending')}
                    </StatusChip>
                  </p>
                </div>
                {editable && (
                  <button
                    type="button"
                    className="gi-button-sm gi-button-ghost text-emergency"
                    aria-label={t('removeFile', { name: document.originalFilename })}
                    onClick={() => {
                      if (window.confirm(t('removeConfirm'))) {
                        void remove(document.id, document.originalFilename);
                      }
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!editable && <p className="mt-4 text-sm text-ink-muted">{t('cannotDeleteAfterSubmit')}</p>}
    </div>
  );
}

function Thumbnail({ preview, alt }: { preview: string | null; alt: string }) {
  if (preview === null) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-inset text-ink-muted"
      >
        <FileIcon className="h-4 w-4" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a blob URL from the file the patient
    // just chose; the image optimiser cannot process one and would only add a round trip.
    <img
      src={preview}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded-md border border-line object-cover"
    />
  );
}

/**
 * `fetch` cannot report upload progress, so this is the one place the codebase drops to
 * `XMLHttpRequest`. Same result shape as `api.upload`, so callers cannot tell the difference.
 */
function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<{ ok: true; data: T } | { ok: false; problem: ApiProblem }> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open('POST', path);
    request.withCredentials = true;

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });

    request.addEventListener('load', () => {
      let body: unknown;
      try {
        body = JSON.parse(request.responseText) as unknown;
      } catch {
        body = undefined;
      }
      if (request.status >= 200 && request.status < 300) {
        resolve({ ok: true, data: body as T });
        return;
      }
      const problem = body as Partial<ApiProblem> | undefined;
      resolve({
        ok: false,
        problem: {
          code: problem?.code ?? 'internal',
          messageKey: problem?.messageKey ?? 'error.generic',
          ...(problem?.details === undefined ? {} : { details: problem.details }),
        },
      });
    });

    request.addEventListener('error', () =>
      resolve({ ok: false, problem: { code: 'network', messageKey: 'error.network' } }),
    );

    request.send(form);
  });
}
