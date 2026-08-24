'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { EmergencyAdvisory } from './types';

/**
 * The emergency escalation.
 *
 * Deliberately not a dismissible toast or a modal that closes on a backdrop tap. It takes the
 * whole screen, the phone numbers are the largest tap targets on it, and carrying on takes a
 * separate, explicitly-labelled action — a patient who taps past this by accident has lost the
 * one message that mattered.
 *
 * Nothing here names a condition. The copy comes from clinician-authored rules and describes the
 * pattern of answers, which is checked at publication time.
 */
export function EmergencyAdvisoryScreen({
  advisory,
  onAcknowledge,
  hasEmergencyContact,
  onNotifyContact,
}: {
  advisory: EmergencyAdvisory;
  onAcknowledge: () => void;
  hasEmergencyContact: boolean;
  onNotifyContact?: () => void;
}) {
  const t = useTranslations('emergency');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [notified, setNotified] = useState(false);

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

          <div className="mt-7 space-y-3">
            {advisory.contacts.map((contact) => (
              <a
                key={contact.number}
                href={`tel:${contact.number}`}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-emergency px-6 py-5 text-xl font-semibold text-white hover:brightness-90"
              >
                <span aria-hidden="true">📞</span>
                {t('callNow')} · {t(`number.${contact.labelKey.split('.').pop()}` as never)}
              </a>
            ))}
          </div>

          {hasEmergencyContact && onNotifyContact !== undefined && (
            <div className="mt-4">
              {notified ? (
                <p className="text-ok" role="status">
                  {t('contactNotified')}
                </p>
              ) : (
                <button
                  type="button"
                  className="gi-button-secondary w-full"
                  onClick={() => {
                    onNotifyContact();
                    setNotified(true);
                  }}
                >
                  {t('notifyContact')}
                </button>
              )}
            </div>
          )}

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
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="tel:112" className="gi-button bg-emergency text-white hover:brightness-90">
          {t('number.general')}
        </a>
        <a href="tel:108" className="gi-button bg-emergency text-white hover:brightness-90">
          {t('number.ambulance')}
        </a>
      </div>
    </div>
  );
}
