'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, type ApiProblem } from '@/lib/api-client';
import { Field, Notice } from '@/components/primitives';
import { DateField } from '@/components/questionnaire/date-field';

/**
 * Profile completion.
 *
 * The date of birth is here rather than at registration because it is the field that decides
 * whether a case can be opened at all — Phase 1 is adults only — and because two red-flag rules
 * depend on age. Getting it through an unambiguous three-field control matters more here than
 * anywhere else in the product.
 */
export function ProfileForm({
  initial,
}: {
  initial: { fullName: string | null; dateOfBirth: string | null; sex: string | null };
}) {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const tAll = useTranslations();
  const router = useRouter();

  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [sex, setSex] = useState(initial.sex ?? '');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  const underEighteen = dateOfBirth !== null && ageFrom(dateOfBirth) < 18;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setProblem(null);

    const result = await api.patch('/api/me', {
      ...(fullName === '' ? {} : { fullName }),
      ...(dateOfBirth === null ? {} : { dateOfBirth }),
      ...(sex === '' ? {} : { sex }),
      ...(phone === '' ? {} : { phone }),
      ...(contactName === '' ? {} : { emergencyContactName: contactName }),
      ...(contactPhone === '' ? {} : { emergencyContactPhone: contactPhone }),
    });
    setPending(false);

    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    router.push('/patient/consent');
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      <Field label={t('fullName')} htmlFor="fullName">
        <input
          id="fullName"
          className="gi-input"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </Field>

      <Field label={t('dateOfBirth')} htmlFor="dob-day" hint={t('dateOfBirthHint')}>
        <DateField value={dateOfBirth} onChange={setDateOfBirth} />
      </Field>

      {/* Stated as soon as we can tell, rather than after they have filled in everything else. */}
      {underEighteen && (
        <Notice tone="urgent" role="alert">
          {tAuth('adultsOnly')}
        </Notice>
      )}

      <Field label={t('sex')} htmlFor="sex">
        <select
          id="sex"
          className="gi-input"
          value={sex}
          onChange={(event) => setSex(event.target.value)}
        >
          <option value="">—</option>
          <option value="female">{t('sexFemale')}</option>
          <option value="male">{t('sexMale')}</option>
          <option value="other">{t('sexOther')}</option>
          <option value="prefer_not_to_say">{t('sexPreferNot')}</option>
        </select>
      </Field>

      <Field label={t('phone')} htmlFor="phone">
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="gi-input"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>

      <fieldset className="mt-8">
        <legend className="gi-label">{t('emergencyContactName')}</legend>
        <p className="gi-hint mb-3">{t('emergencyContactHint')}</p>
        <input
          className="gi-input mb-3"
          aria-label={t('emergencyContactName')}
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
        />
        <input
          className="gi-input"
          type="tel"
          inputMode="tel"
          aria-label={t('emergencyContactPhone')}
          value={contactPhone}
          onChange={(event) => setContactPhone(event.target.value)}
        />
      </fieldset>

      {problem !== null && (
        <div className="mt-4">
          <Notice tone="emergency" role="alert">
            {tAll(problem.messageKey as never)}
          </Notice>
        </div>
      )}

      <button type="submit" className="gi-button-primary mt-8 w-full" disabled={pending}>
        {t('save')}
      </button>
    </form>
  );
}

function ageFrom(isoDate: string): number {
  const born = new Date(`${isoDate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) years -= 1;
  return years;
}
