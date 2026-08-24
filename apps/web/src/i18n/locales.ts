/**
 * The languages the interface can serve.
 *
 * Interface chrome lives in `messages/*.json`. Clinical text — question prompts, answer options,
 * consent wording, red-flag copy — lives with the versioned clinical content instead, because a
 * translation of a symptom question has to be clinician-approved and versioned alongside the
 * question it translates (design D12).
 */

export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

export function isSupportedLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}
