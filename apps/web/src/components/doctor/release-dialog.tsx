'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Badge, Notice } from '@/components/primitives';
import type { ReferralUrgency } from './types';

/**
 * The release confirmation.
 *
 * Shows the exact text the patient will read, laid out the way the patient will see it, and sends
 * that same object as the confirmed content — so what the doctor approved and what gets frozen
 * are one thing, not two reads of a draft that could have changed between them.
 *
 * Nothing auto-confirms. There is no timer, no default-focused confirm button, and no keyboard
 * shortcut: releasing a clinical impression to a patient should take a deliberate act.
 */
export function ReleaseDialog({
  caseId,
  summary,
  nextSteps,
  diagnosis,
  dietaryAdvice,
  precautions,
  referralUrgency,
  followUpInterval,
  prescriptionInstructions,
  onCancel,
  onReleased,
}: {
  caseId: string;
  summary: string;
  nextSteps: string[];
  diagnosis: string;
  dietaryAdvice: string;
  precautions: string;
  referralUrgency: ReferralUrgency;
  followUpInterval: string;
  prescriptionInstructions: string;
  onCancel: () => void;
  onReleased: () => void;
}) {
  const t = useTranslations('doctor');
  const tApp = useTranslations('app');
  const tAll = useTranslations();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    headingRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; opener?.focus(); };
  }, []);

  async function release() {
    setPending(true);
    setProblem(null);

    const result = await api.post(`/api/doctor/cases/${caseId}/release`, {
      confirmedContent: {
        summary,
        nextSteps,
        diagnosis,
        dietaryAdvice,
        precautions,
        referralUrgency,
        followUpInterval,
        prescriptionInstructions,
      },
      confirm: true,
    });
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onReleased();
  }

  const sections = [
    { key: 'diagnosis', label: t('diagnosis'), body: diagnosis },
    { key: 'dietary', label: t('dietaryAdvice'), body: dietaryAdvice },
    { key: 'precautions', label: t('precautions'), body: precautions },
    { key: 'followUp', label: t('followUpInterval'), body: followUpInterval },
    { key: 'prescriptions', label: t('prescriptionInstructions'), body: prescriptionInstructions },
  ].filter((section) => section.body.trim() !== '');

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
      className="gi-scroll fixed max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-surface p-0 text-ink shadow-overlay backdrop:bg-surface-deep/50"
      aria-labelledby="release-heading"
    >
      <div className="p-6">
        <h2 id="release-heading" ref={headingRef} tabIndex={-1} className="text-xl outline-none">
          {t('releaseConfirmHeading')}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{t('releaseConfirmBody')}</p>

        <div className="gi-scroll mt-5 max-h-[50vh] space-y-4 overflow-y-auto rounded-xl border border-line bg-surface-sunken p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                referralUrgency === 'emergency'
                  ? 'emergency'
                  : referralUrgency === 'within_week'
                    ? 'urgent'
                    : referralUrgency === 'routine'
                      ? 'accent'
                      : 'neutral'
              }
            >
              {t(`referral_${referralUrgency}` as never)}
            </Badge>
          </div>

          <div>
            <h3 className="gi-section-title">{t('patientSummary')}</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{summary}</p>
          </div>

          {sections.map((section) => (
            <div key={section.key}>
              <h3 className="gi-section-title">{section.label}</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{section.body}</p>
            </div>
          ))}
          {nextSteps.length > 0 && <section><h3 className="gi-section-title">{t('workupInstructions')}</h3><ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">{nextSteps.map((step, index) => <li key={index}>{step}</li>)}</ul></section>}
        </div>

        {problem !== null && (
          <div className="mt-4">
            <Notice tone="emergency" role="alert">
              {tAll(problem.messageKey as never)}
            </Notice>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="gi-button-secondary" onClick={onCancel} disabled={pending}>
            {tApp('cancel')}
          </button>
          <button
            type="button"
            className="gi-button-primary"
            disabled={pending}
            onClick={() => void release()}
          >
            {pending ? t('releasing') : t('releaseConfirm')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
