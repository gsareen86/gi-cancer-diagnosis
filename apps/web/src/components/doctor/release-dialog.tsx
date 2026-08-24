'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Notice } from '@/components/primitives';

/**
 * The release confirmation.
 *
 * Shows the exact text the patient will read, and sends that same text as the confirmed content —
 * so what the doctor approved and what gets frozen are the same object, not two reads of a draft
 * that could have changed between them.
 *
 * Nothing auto-confirms. There is no timer, no default-focused confirm button, and no keyboard
 * shortcut: releasing a clinical impression to a patient should take a deliberate act.
 */
export function ReleaseDialog({
  caseId,
  summary,
  nextSteps,
  onCancel,
  onReleased,
}: {
  caseId: string;
  summary: string;
  nextSteps: string[];
  onCancel: () => void;
  onReleased: () => void;
}) {
  const t = useTranslations('doctor');
  const tApp = useTranslations('app');
  const tAll = useTranslations();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function release() {
    setPending(true);
    setProblem(null);

    const result = await api.post(`/api/doctor/cases/${caseId}/release`, {
      confirmedContent: { summary, nextSteps },
      confirm: true,
    });
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onReleased();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-heading"
    >
      <div className="w-full max-w-reading rounded-2xl bg-surface p-6 shadow-lg">
        <h2 id="release-heading" ref={headingRef} tabIndex={-1} className="text-xl outline-none">
          {t('releaseConfirmHeading')}
        </h2>
        <p className="mt-2 text-ink-muted">{t('releaseConfirmBody')}</p>

        <div className="mt-5 rounded-xl border border-line bg-surface-sunken p-4">
          <p className="whitespace-pre-wrap">{summary}</p>
          {nextSteps.length > 0 && (
            <ul className="mt-3 list-inside list-disc">
              {nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          )}
        </div>

        {problem !== null && (
          <div className="mt-4">
            <Notice tone="emergency" role="alert">
              {tAll(problem.messageKey as never)}
            </Notice>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="gi-button-secondary" onClick={onCancel}>
            {tApp('cancel')}
          </button>
          <button
            type="button"
            className="gi-button-primary"
            disabled={pending}
            onClick={() => void release()}
          >
            {t('releaseConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
