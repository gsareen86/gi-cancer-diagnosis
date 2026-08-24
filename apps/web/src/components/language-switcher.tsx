'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_NAMES, type Locale } from '@/i18n/locales';

/**
 * Switching language mid-interview is safe: answers are stored as option identifiers, not as the
 * text the patient saw, so nothing they have already answered changes meaning.
 *
 * Only locales the published clinical content can actually serve are offered. Interface chrome is
 * translated for every language in the catalogue, but a question is clinical content: serving it
 * in English under a Hindi interface would give the patient a half-translated screen, and
 * machine-translating a symptom question would give them a wrong one. Where the clinical
 * translation has not been clinician-approved, the language is simply not on the list.
 */
export function LanguageSwitcher({ available }: { available: readonly Locale[] }) {
  const locale = useLocale() as Locale;
  // One servable language is not a choice; showing a dropdown with a single entry is noise.
  const showSwitcher = available.length > 1;
  const t = useTranslations('app');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    // A cookie rather than a URL segment: the case identifier in the address bar must not change
    // under a patient part-way through answering.
    document.cookie = `gi_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  if (!showSwitcher) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="locale-switcher">
        {t('languageLabel')}
      </label>
      <select
        id="locale-switcher"
        className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
        value={locale}
        disabled={pending}
        onChange={(event) => change(event.target.value as Locale)}
      >
        {available.map((option) => (
          <option key={option} value={option}>
            {LOCALE_NAMES[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
