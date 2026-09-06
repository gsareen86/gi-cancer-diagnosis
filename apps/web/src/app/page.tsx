import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { servableLocales } from '@/lib/servable-locales';
import { currentUser } from '@/lib/session';
import { homePathFor } from '@/lib/guard';
import {
  ClipboardIcon,
  ShieldIcon,
  StethoscopeIcon,
  UploadIcon,
  UsersIcon,
} from '@/components/ui/icons';

/**
 * The public landing page.
 *
 * Deliberately modest. Everything a patient reads before signing up shapes what they expect to
 * receive, and this system does not produce a diagnosis — so the page describes a process (you
 * answer questions, a doctor reads them, a doctor writes back) rather than an outcome, and says
 * what it is not before asking anyone to register.
 */
export default async function HomePage() {
  const t = await getTranslations('home');
  const tApp = await getTranslations('app');
  const tNotice = await getTranslations('standingNotice');
  const user = await currentUser();

  // Signed in: go where this person actually works, rather than showing them a marketing page.
  if (user !== null) redirect(homePathFor(user.role));

  const steps = [
    { icon: ClipboardIcon, title: t('step1Title'), body: t('step1Body') },
    { icon: UploadIcon, title: t('step2Title'), body: t('step2Body') },
    { icon: StethoscopeIcon, title: t('step3Title'), body: t('step3Body') },
  ];

  const assurances = [
    { icon: StethoscopeIcon, title: t('assuranceReviewTitle'), body: t('assuranceReviewBody') },
    { icon: ShieldIcon, title: t('assurancePrivacyTitle'), body: t('assurancePrivacyBody') },
    { icon: UsersIcon, title: t('assuranceLanguageTitle'), body: t('assuranceLanguageBody') },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <span className="flex items-center gap-2.5 font-semibold tracking-tight text-ink">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-deep text-white"
            >
              <StethoscopeIcon className="h-4 w-4" />
            </span>
            {tApp('name')}
          </span>
          <div className="flex items-center gap-2">
            <LanguageSwitcher available={await servableLocales()} />
            <Link href="/login" className="gi-button-sm text-ink-muted hover:text-ink">
              {t('signIn')}
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="border-b border-line bg-gradient-to-b from-accent-faint/40 to-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent">
                {t('eyebrow')}
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl">{t('heading')}</h1>
              <p className="mt-5 text-lg leading-relaxed text-ink-muted">{t('intro')}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="gi-button-primary">
                  {t('getStarted')}
                </Link>
                <Link href="/login" className="gi-button-secondary">
                  {t('signIn')}
                </Link>
              </div>

              <p className="mt-6 text-sm text-ink-muted">{tNotice('notADiagnosis')}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <h2 className="text-xl sm:text-2xl">{t('howItWorks')}</h2>
          <ol className="mt-7 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="gi-card">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-faint text-accent"
                  >
                    <step.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="gi-numeric text-2xs font-semibold uppercase tracking-[0.1em] text-ink-faint">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg">{step.title}</h3>
                <p className="mt-1.5 text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-line bg-surface-sunken">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
            <h2 className="text-xl sm:text-2xl">{t('assuranceHeading')}</h2>
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {assurances.map((item) => (
                <div key={item.title}>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-accent"
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  <h3 className="mt-4 text-base">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl space-y-1 px-5 py-8 text-sm text-ink-muted sm:px-8">
          <p>{tNotice('notADiagnosis')}</p>
          <p className="font-medium text-ink">{tNotice('seekCare')}</p>
        </div>
      </footer>
    </div>
  );
}
