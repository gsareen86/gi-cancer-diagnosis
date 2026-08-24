import { servableLocales as servableFromDocument } from '@gi-compass/core';
import { currentPublishedTemplate } from '@/server/services/content-service';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/locales';

/**
 * The languages this deployment can actually serve a patient.
 *
 * A language qualifies only when the published clinical content carries clinician-approved text
 * for it. Interface chrome being translated is not enough: the questions are the product, and a
 * Hindi interface wrapped around English symptom questions is worse than an English one, because
 * it implies a translation that is not there.
 */
export async function servableLocales(): Promise<Locale[]> {
  try {
    const { document } = await currentPublishedTemplate();
    const locales = servableFromDocument(document).filter(isSupportedLocale);
    return locales.length > 0 ? locales : [DEFAULT_LOCALE];
  } catch {
    // No published template yet (a fresh deployment, or the admin console before first publish).
    return [DEFAULT_LOCALE];
  }
}
