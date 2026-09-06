import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/language-switcher';
import { servableLocales } from '@/lib/servable-locales';
import { ShieldIcon, StethoscopeIcon, UsersIcon } from '@/components/ui/icons';

/**
 * The authentication shell.
 *
 * Two columns on a wide screen: the form on the left, and on the right a standing statement of
 * what this system is. That panel is not decoration. Someone signing in to a service holding
 * their clinical history should be told, before they type a password, that a registered doctor
 * reviews every case and that nothing here is a diagnosis — the same three facts the footer
 * carries everywhere else, said once at the door.
 *
 * On a phone the panel drops entirely and the form fills the screen, because a patient
 * completing a password reset on mobile data does not need a value proposition.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth');
  const tApp = await getTranslations('app');
  const tShell = await getTranslations('shell');

  const points = [
    { icon: StethoscopeIcon, text: t('assuranceDoctor') },
    { icon: ShieldIcon, text: t('assurancePrivacy') },
    { icon: UsersIcon, text: t('assuranceLanguage') },
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-ink">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-deep text-white"
            >
              <StethoscopeIcon className="h-4 w-4" />
            </span>
            {tApp('name')}
          </Link>
          <LanguageSwitcher available={await servableLocales()} />
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="px-5 py-6 text-sm text-ink-muted sm:px-8">
          <p className="gi-prose">{tShell('authFooter')}</p>
        </footer>
      </div>

      <aside className="hidden bg-surface-deep px-12 py-16 lg:flex lg:w-[26rem] lg:flex-col lg:justify-center xl:w-[32rem]">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent-line">
          {tApp('name')}
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-white">
          {t('assuranceHeading')}
        </h2>

        <ul className="mt-8 space-y-5">
          {points.map((point) => (
            <li key={point.text} className="flex gap-3.5">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-deepMuted text-accent-line"
              >
                <point.icon className="h-4 w-4" />
              </span>
              <p className="text-sm leading-relaxed text-line-strong">{point.text}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 border-t border-line-deep pt-6 text-xs leading-relaxed text-line-strong">
          {t('assuranceFooter')}
        </p>
      </aside>
    </div>
  );
}
