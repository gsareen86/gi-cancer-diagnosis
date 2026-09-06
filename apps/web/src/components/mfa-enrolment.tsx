'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Card, Field, Notice, Spinner } from '@/components/primitives';
import { homePathFor, safeNext } from '@/lib/navigation';

interface Enrolment {
  otpauthUri: string;
  secret: string;
}

/**
 * Second-factor enrolment and verification.
 *
 * Accounts that can read patient records need a second factor, so this is the first thing a
 * doctor sees after signing in. It has to work on the first try: a clinician locked out of a
 * review queue has no self-service route back in.
 *
 * Both the QR code and the typed secret are offered — a phone camera fails often enough that
 * "scan this" alone is not a complete answer.
 */
export function MfaEnrolment({ alreadyEnrolled, nextPath = null }: { alreadyEnrolled: boolean; nextPath?: string | null }) {
  const t = useTranslations('auth');
  const tAll = useTranslations();
  const router = useRouter();

  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [pending, setPending] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // An account that already has a confirmed factor is signing in, not enrolling: it needs the
  // code field only, and asking the server for a new secret would be refused anyway.
  useEffect(() => {
    if (alreadyEnrolled) return;
    let cancelled = false;

    void api.post<Enrolment>('/api/auth/mfa/enroll').then(async (result) => {
      if (cancelled) return;
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      setEnrolment(result.data);
      const { toDataURL } = await import('qrcode');
      const image = await toDataURL(result.data.otpauthUri, { width: 220, margin: 1 });
      if (!cancelled) setQr(image);
    });

    return () => {
      cancelled = true;
    };
  }, [alreadyEnrolled]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setProblem(null);

    const result = await api.post<{ role: string }>('/api/auth/mfa/verify', { code });
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }

    const role = result.data.role;
    router.replace(safeNext(nextPath) ?? homePathFor(role));
    router.refresh();
  }

  return (
    <div>
      {!alreadyEnrolled && (
        <Card className="mb-6">
          <h2 className="text-lg">{t('mfaScanHeading')}</h2>
          <p className="mt-1 text-ink-muted">{t('mfaScanBody')}</p>

          {enrolment === null ? (
            <p className="mt-4">
              <Spinner label={tAll('app.loading')} />
            </p>
          ) : (
            <div className="mt-4">
              {qr !== null && (
                <img
                  src={qr}
                  // The QR encodes the same secret shown below it, so it needs no separate
                  // description — but it must not be announced as meaningful decoration either.
                  alt={t('mfaQrAlt')}
                  width={220}
                  height={220}
                  className="rounded-lg border border-line bg-white p-2"
                />
              )}

              <button
                type="button"
                className="mt-3 text-sm font-medium text-accent underline underline-offset-4"
                aria-expanded={showSecret}
                onClick={() => setShowSecret((value) => !value)}
              >
                {t('mfaCannotScan')}
              </button>

              {showSecret && (
                <p className="mt-2 select-all rounded-lg bg-surface-sunken p-3 font-mono text-sm">
                  {enrolment.secret}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      <Card>
        <form onSubmit={submit} noValidate>
          <Field label={t('mfaCodeLabel')} htmlFor="code" hint={t('mfaCodeHint')}>
            <input
              id="code"
              className="gi-input max-w-[10rem] font-mono text-lg tracking-widest"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>

          {problem !== null && (
            <Notice tone="emergency" role="alert">
              {tAll(problem.messageKey as never)}
            </Notice>
          )}

          <button
            type="submit"
            className="gi-button-primary mt-4 w-full"
            disabled={pending || code.trim().length < 6}
          >
            {t('mfaVerify')}
          </button>
        </form>
      </Card>
    </div>
  );
}
