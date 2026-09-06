'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { EmergencyAdvisory } from './types';

/**
 * The emergency escalation.
 *
 * Deliberately not a dismissible toast or a modal that closes on a backdrop tap. It takes the
 * whole screen, immediate in-person assistance is the main action, and carrying on takes a
 * separate, explicitly-labelled action — a patient who taps past this by accident has lost the
 * one message that mattered.
 *
 * Nothing here names a condition. The copy comes from clinician-authored rules and describes the
 * pattern of answers, which is checked at publication time.
 */
export function EmergencyAdvisoryScreen({
  advisory,
  onAcknowledge,
}: {
  advisory: EmergencyAdvisory;
  onAcknowledge: () => void;
}) {
  const t = useTranslations('emergency');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Move focus to the heading so a screen-reader user lands on the advisory rather than
    // continuing to read the question behind it.
    headingRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-emergency-faint"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-heading"
    >
      <div className="mx-auto flex min-h-full max-w-reading flex-col justify-center px-5 py-10">
        <div className="rounded-2xl border-2 border-emergency bg-surface p-6 shadow-lg sm:p-8">
          <h1
            id="emergency-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl text-emergency"
          >
            {t('heading')}
          </h1>

          <div className="mt-5 space-y-3 text-lg">
            {advisory.messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>

          <p className="mt-7 rounded-xl border border-emergency bg-emergency-faint p-5 text-lg font-semibold text-emergency">{t('seekImmediateCare')}</p>
          <p className="mt-3 text-ink-muted">{t('doNotWait')}</p>

          <hr className="my-7 border-line" />

          <button type="button" className="gi-button-secondary w-full" onClick={onAcknowledge}>
            {t('acknowledge')}
          </button>
          <p className="mt-2 text-sm text-ink-muted">{t('acknowledgeHint')}</p>
        </div>
      </div>
    </div>
  );
}

/** Stays visible for the rest of the session once the advisory has been acknowledged. */
export function EmergencyBanner() {
  const t = useTranslations('emergency');
  return (
    <div
      role="status"
      className="mb-6 rounded-xl border-2 border-emergency bg-emergency-faint p-4 text-emergency"
    >
      <p className="font-semibold">{t('persistentBanner')}</p>
      <p className="mt-2 text-sm">{t('doNotWait')}</p>
    </div>
  );
}
