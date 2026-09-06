import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';

/**
 * The root layout carries only what every page needs regardless of who is looking: the locale,
 * the toast host, and the skip link.
 *
 * The chrome moved out. Before this change a single header and footer wrapped the sign-in page,
 * the patient's questionnaire and the doctor's queue alike, which is why none of them had a way
 * to sign out — there was nowhere role-specific to put it. Each workspace now brings its own
 * shell, and `(auth)` brings its own.
 */

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
  themeColor: '#0F172A',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations('app');

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider dismissLabel={t('dismiss')}>
            <a href="#main" className="gi-skip-link">
              {t('skipToContent')}
            </a>
            {children}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
