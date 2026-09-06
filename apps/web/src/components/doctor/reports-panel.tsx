'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/ui/feedback';
import { ChevronRightIcon, FileIcon } from '@/components/ui/icons';
import { DocumentDrawer } from './document-drawer';
import type { CaseWorkspaceData } from './types';

/** Source reports live in their own Navigator section so the clinical record stays scannable. */
export function ReportsPanel({ caseId, data }: { caseId: string; data: CaseWorkspaceData }) {
  const t = useTranslations('doctor');
  const [openDocument, setOpenDocument] = useState<string | null>(null);
  const closeDocument = useCallback(() => setOpenDocument(null), []);
  const document = data.documents.find((entry) => entry.id === openDocument) ?? null;

  return (
    <div className="space-y-4">
      {data.documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-sunken px-5 py-10 text-center">
          <FileIcon className="mx-auto h-6 w-6 text-ink-faint" />
          <p className="mt-3 text-sm text-ink-muted">{t('noDocuments')}</p>
        </div>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {data.documents.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setOpenDocument(entry.id)}
                className="flex min-h-24 w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-line-strong hover:bg-surface-inset"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-faint text-accent"
                >
                  <FileIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold">
                    {entry.originalFilename}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    {entry.patientTypeTag !== null && (
                      <StatusChip tone="neutral" dot={false}>
                        {entry.patientTypeTag}
                      </StatusChip>
                    )}
                    {entry.machineReadable === false ? (
                      <StatusChip tone="urgent" dot={false}>
                        {t('documentUnreadable')}
                      </StatusChip>
                    ) : (
                      !entry.extractVerified && (
                        <StatusChip tone="caution" dot={false}>
                          {t('documentUnverified')}
                        </StatusChip>
                      )
                    )}
                  </span>
                </span>
                <ChevronRightIcon className="mt-2 h-4 w-4 shrink-0 text-accent" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <DocumentDrawer caseId={caseId} document={document} onClose={closeDocument} />
    </div>
  );
}
