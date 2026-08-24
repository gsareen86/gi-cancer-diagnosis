'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Field, Notice } from '@/components/primitives';

interface PasswordProblem {
  code: string;
  messageKey: string;
  params?: Record<string, string | number>;
}

/**
 * Password rejections are shown as the specific unmet rules, not a single "invalid password".
 * Someone who has just been told their passphrase is too short can fix it; someone told it is
 * invalid will try another word of the same length.
 */
function PasswordProblems({ problems }: { problems: PasswordProblem[] }) {
  const t = useTranslations();
  return (
    <ul className="gi-error list-inside list-disc space-y-1">
      {problems.map((problem) => (
        <li key={problem.code}>{t(problem.messageKey as never, problem.params ?? {})}</li>
      ))}
    </ul>
  );
}

function useProblemText() {
  const t = useTranslations();
  return (problem: ApiProblem) => t(problem.messageKey as never);
}

export function RegisterForm() {
  const t = useTranslations('auth');
  const text = useProblemText();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setProblem(null);

    const result = await api.post('/api/auth/register', { email, password });
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    // The same screen appears whether or not the address already had an account — this endpoint
    // must not tell an unauthenticated visitor who is a patient here.
    setSent(true);
  }

  if (sent) {
    return (
      <Notice tone="ok" title={t('verifyHeading')} role="status">
        {t('verifySent')}
      </Notice>
    );
  }

  const passwordProblems =
    problem?.code === 'invalid_request' &&
    typeof problem.details === 'object' &&
    problem.details !== null &&
    'problems' in problem.details
      ? ((problem.details as { problems: PasswordProblem[] }).problems ?? [])
      : [];

  return (
    <form onSubmit={submit} noValidate>
      <Field label={t('email')} htmlFor="email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="gi-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label={t('password')} htmlFor="password" hint={t('passwordHint')}>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          className="gi-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      {passwordProblems.length > 0 && <PasswordProblems problems={passwordProblems} />}
      {problem !== null && passwordProblems.length === 0 && (
        <Notice tone="emergency" role="alert">
          {text(problem)}
        </Notice>
      )}

      <button type="submit" className="gi-button-primary mt-6 w-full" disabled={pending}>
        {t('register')}
      </button>

      <p className="mt-5 text-sm text-ink-muted">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-medium text-accent underline underline-offset-4">
          {t('login')}
        </Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  const t = useTranslations('auth');
  const text = useProblemText();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setProblem(null);

    const result = await api.post<{ role: string; mfaPending: boolean }>('/api/auth/login', {
      email,
      password,
    });
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }

    if (result.data.mfaPending) {
      router.push('/mfa');
    } else if (result.data.role === 'doctor') {
      router.push('/doctor/queue');
    } else if (result.data.role === 'patient') {
      router.push('/cases');
    } else {
      router.push('/admin');
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      <Field label={t('email')} htmlFor="email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="gi-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label={t('password')} htmlFor="password">
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          className="gi-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      {problem !== null && (
        <Notice tone="emergency" role="alert">
          {text(problem)}
        </Notice>
      )}

      <button type="submit" className="gi-button-primary mt-6 w-full" disabled={pending}>
        {t('login')}
      </button>

      <div className="mt-5 space-y-2 text-sm text-ink-muted">
        <p>
          <Link
            href="/reset-password"
            className="font-medium text-accent underline underline-offset-4"
          >
            {t('forgotPassword')}
          </Link>
        </p>
        <p>
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-accent underline underline-offset-4">
            {t('register')}
          </Link>
        </p>
      </div>
    </form>
  );
}

export function ResetRequestForm() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    await api.post('/api/auth/password-reset/request', { email });
    setPending(false);
    // Always the same outcome, whether or not that address has an account.
    setSent(true);
  }

  if (sent) {
    return (
      <Notice tone="ok" role="status">
        {t('resetSent')}
      </Notice>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Field label={t('email')} htmlFor="email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="gi-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <button type="submit" className="gi-button-primary w-full" disabled={pending}>
        {t('resetSend')}
      </button>
    </form>
  );
}

export function ResetCompleteForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const text = useProblemText();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setProblem(null);

    const result = await api.post('/api/auth/password-reset/complete', { token, password });
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    router.push('/login');
  }

  const passwordProblems =
    typeof problem?.details === 'object' && problem.details !== null && 'problems' in problem.details
      ? ((problem.details as { problems: PasswordProblem[] }).problems ?? [])
      : [];

  return (
    <form onSubmit={submit} noValidate>
      <Field label={t('newPassword')} htmlFor="password" hint={t('passwordHint')}>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          className="gi-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      {passwordProblems.length > 0 && <PasswordProblems problems={passwordProblems} />}
      {problem !== null && passwordProblems.length === 0 && (
        <Notice tone="emergency" role="alert">
          {text(problem)}
        </Notice>
      )}

      <button type="submit" className="gi-button-primary mt-6 w-full" disabled={pending}>
        {t('resetSend')}
      </button>
    </form>
  );
}
