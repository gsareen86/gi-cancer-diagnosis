import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from './locales';

/**
 * Resolves the locale for a request.
 *
 * The locale lives in a cookie rather than the URL: a patient part-way through an interview who
 * switches language must not have their case identifier change under them, and a URL that
 * encodes the language leaks nothing useful but complicates every link.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const requested = store.get('gi_locale')?.value;
  const locale: Locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Dates and numbers are rendered for the reader's locale, but a date a patient *enters* is
    // captured through controls that make day, month, and year explicit — see DateField.
    timeZone: 'Asia/Kolkata',
    now: new Date(),
    onError(error) {
      // A missing translation falls back to English and is recorded. It never renders a raw key
      // in front of a patient, and it never fails the page.
      if (error.code === 'MISSING_MESSAGE') {
        console.warn(`[i18n] missing message: ${error.message}`);
        return;
      }
      console.error('[i18n]', error);
    },
    getMessageFallback({ namespace, key }) {
      return `${namespace ?? ''}.${key}`;
    },
  };
});
