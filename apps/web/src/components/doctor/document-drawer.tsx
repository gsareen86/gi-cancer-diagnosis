'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Notice } from '@/components/primitives';
import { StatusChip } from '@/components/ui/feedback';
import { Drawer } from '@/components/ui/navigation';
import { ExpandIcon, FileIcon, ZoomInIcon, ZoomOutIcon } from '@/components/ui/icons';
import type { CaseDocument } from './types';

/**
 * The uploaded-report viewer.
 *
 * A drawer rather than a route, because a doctor comparing a histopathology extract against an
 * answer must not lose the answer to see the report. The case stays rendered behind it.
 *
 * The document itself is fetched from `/api/cases/{caseId}/documents/{id}`, which is where the
 * authorization and the short-lived signed URL live — nothing here handles a storage key, and the
 * drawer cannot reach a document the API would refuse.
 *
 * Zoom applies only to images. A PDF is handed to the browser's own viewer, which already has
 * zoom, search and print, and reimplementing that on top of an embedded object would be worse at
 * all three.
 */

const ZOOM_STEPS = [1, 1.5, 2, 3] as const;

export function DocumentDrawer({
  caseId,
  document,
  onClose,
}: {
  caseId: string;
  document: CaseDocument | null;
  onClose: () => void;
}) {
  const t = useTranslations('doctor');
  const tCommon = useTranslations('app');
  const [zoom, setZoom] = useState(0);
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // A new document opens at its natural size rather than inheriting the last one's zoom.
    setZoom(0);
    setSource(null);
    setFailed(false);
    if (!document) return;
    let active = true;
    void api.get<{ url: string }>(`/api/cases/${caseId}/documents/${document.id}`).then((result) => {
      if (!active) return;
      if (result.ok) setSource(result.data.url); else setFailed(true);
    });
    return () => { active = false; };
  }, [caseId, document?.id]);

  if (document === null) return null;

  const isImage = document.contentType.startsWith('image/');
  const isPdf = document.contentType === 'application/pdf';
  const scale = ZOOM_STEPS[zoom] ?? 1;

  const extract = readExtract(document.extract);

  return (
    <Drawer
      open
      width="max-w-[92rem]"
      onClose={onClose}
      title={document.originalFilename}
      closeLabel={t('closeDocument')}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {document.patientTypeTag !== null && (
              <StatusChip tone="neutral" dot={false}>
                {document.patientTypeTag}
              </StatusChip>
            )}
            <StatusChip
              tone={document.scanStatus === 'clean' ? 'ok' : 'caution'}
              dot={false}
            >
              {t(`scan_${document.scanStatus}` as never)}
            </StatusChip>
            {!document.extractVerified && (
              <StatusChip tone="caution" dot={false}>
                {t('documentUnverified')}
              </StatusChip>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isImage && (
              <>
                <button
                  type="button"
                  className="gi-button-sm gi-button-secondary"
                  aria-label={t('zoomOut')}
                  disabled={zoom === 0}
                  onClick={() => setZoom((current) => Math.max(0, current - 1))}
                >
                  <ZoomOutIcon className="h-4 w-4" />
                </button>
                <span className="gi-numeric w-12 text-center text-xs text-ink-muted">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  className="gi-button-sm gi-button-secondary"
                  aria-label={t('zoomIn')}
                  disabled={zoom === ZOOM_STEPS.length - 1}
                  onClick={() =>
                    setZoom((current) => Math.min(ZOOM_STEPS.length - 1, current + 1))
                  }
                >
                  <ZoomInIcon className="h-4 w-4" />
                </button>
              </>
            )}
            {source !== null && <a
              href={source}
              target="_blank"
              rel="noreferrer"
              className="gi-button-sm gi-button-secondary"
            >
              <ExpandIcon className="h-4 w-4" />
              {t('openFullScreen')}
            </a>}
          </div>
        </div>
      }
    >
      <div className="grid min-h-0 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="gi-scroll min-w-0 bg-surface-inset p-4">
        {source === null ? <p className="p-6 text-sm text-ink-muted" role="status">{failed ? t('previewUnavailable') : tCommon('loading')}</p> : isImage ? (
          <div className="overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- served through the audited
                document endpoint, never a static asset, so the image optimiser has nothing to do
                and would only add a second cache of clinical content. */}
            <img
              src={source}
              alt={t('documentAlt', { filename: document.originalFilename })}
              style={{ width: `${scale * 100}%` }}
              className="mx-auto max-w-none rounded border border-line bg-surface"
            />
          </div>
        ) : isPdf ? (
          <iframe src={source} title={t('documentAlt', { filename: document.originalFilename })} className="h-[70vh] w-full rounded border border-line bg-surface" />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded border border-line bg-surface p-10 text-center">
            <FileIcon className="h-8 w-8 text-ink-faint" />
            <p className="text-sm text-ink-muted">{t('previewUnavailable')}</p>
            <a href={source} className="gi-button-secondary" target="_blank" rel="noreferrer">
              {t('openOriginal')}
            </a>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4">
        {document.machineReadable === false && (
          <Notice tone="urgent" role="note">
            {t('documentUnreadableDetail')}
          </Notice>
        )}

        {extract !== null && (
          <section>
            <h3 className="gi-section-title">{t('extractHeading')}</h3>
            {/* Labelled wherever it appears. An extract nobody has checked is a hypothesis. */}
            <div className="mt-1.5">
              <Notice tone={document.extractVerified ? 'ok' : 'caution'} role="note">
                {document.extractVerified ? t('extractVerified') : t('extractUnverified')}
              </Notice>
            </div>
            <pre className="gi-scroll mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-sunken p-3 text-xs">
              {extract}
            </pre>
          </section>
        )}
      </div>
      </div>
    </Drawer>
  );
}

/** The extract is model output of unpredictable shape; render it as text or not at all. */
function readExtract(extract: unknown): string | null {
  if (extract === null || extract === undefined) return null;
  if (typeof extract === 'string') return extract.trim() === '' ? null : extract;
  try {
    return JSON.stringify(extract, null, 2);
  } catch {
    return null;
  }
}
