import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import './globals.css';
import { LanguageSwitcher } from '@/components/language-switcher';
import { servableLocales } from '@/lib/servable-locales';

export const metadata: Metadata = {
  title: 'GI Compass',
  description: 'A guided symptom questionnaire, reviewed by a registered doctor.',
  // A clinical record should never be indexed, previewed, or cached by a crawler.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is never disabled: a patient who needs to enlarge a reference image must be able to.
  maximumScale: 5,
  themeColor: '#0f6d8c',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations('app');

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a href="#main" className="gi-skip-link">
            {t('skipToContent')}
          </a>

          <header className="border-b border-line bg-surface">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <a href="/" className="font-semibold tracking-tight text-ink">
                {t('name')}
              </a>
              <LanguageSwitcher available={await servableLocales()} />
            </div>
          </header>

          <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </main>

          <footer className="mt-auto border-t border-line bg-surface">
            <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-ink-muted sm:px-6">
              <StandingNotice />
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

/**
 * Shown on every page, not just the questionnaire.
 *
 * A patient who lands on their case status at 2am and reads "with the doctor" needs to know, in
 * that same moment, that waiting is not the right move if things are getting worse.
 */
async function StandingNotice() {
  const t = await getTranslations('standingNotice');
  return (
    <div className="gi-prose space-y-1">
      <p>{t('notADiagnosis')}</p>
      <p className="font-medium text-ink">{t('seekCare')}</p>
    </div>
  );
}
