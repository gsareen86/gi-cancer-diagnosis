'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { Notice } from '@/components/primitives';

/**
 * Access, correction, and erasure requests.
 *
 * Erasure asks for a second confirmation that names what will go and what will stay — the audit
 * record of who accessed the data survives, pseudonymously, because it has to. Agreeing to delete
 * without being told that would not be informed agreement.
 */
export function DataSubjectRights() {
  const t = useTranslations('privacy');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [confirmingErasure, setConfirmingErasure] = useState(false);
  const [pending, setPending] = useState(false);

  async function request(type: 'access' | 'correction' | 'erasure') {
    setPending(true);
    const result = await api.post('/api/privacy/requests', { type });
    setPending(false);
    if (result.ok) {
      setSubmitted(type);
      setConfirmingErasure(false);
    }
  }

  if (submitted !== null) {
    return (
      <Notice tone="ok" role="status">
        {t('requestSubmitted')}
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="gi-button-secondary w-full"
        disabled={pending}
        onClick={() => void request('access')}
      >
        {t('requestExport')}
      </button>

      <button
        type="button"
        className="gi-button-secondary w-full"
        disabled={pending}
        onClick={() => void request('correction')}
      >
        {t('requestCorrection')}
      </button>

      {confirmingErasure ? (
        <div className="rounded-xl border-2 border-emergency p-4">
          <p className="font-semibold">{t('erasureWarningHeading')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('erasureWarningBody')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="gi-button-secondary"
              onClick={() => setConfirmingErasure(false)}
            >
              {t('requestCorrection')}
            </button>
            <button
              type="button"
              className="gi-button-danger"
              disabled={pending}
              onClick={() => void request('erasure')}
            >
              {t('erasureConfirm')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="gi-button-secondary w-full text-emergency"
          onClick={() => setConfirmingErasure(true)}
        >
          {t('requestErasure')}
        </button>
      )}
    </div>
  );
}
