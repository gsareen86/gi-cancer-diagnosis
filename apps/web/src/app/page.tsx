import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/primitives';
import { currentUser } from '@/lib/session';

export default async function HomePage() {
  const t = await getTranslations('home');
  const user = await currentUser();

  if (user !== null) {
    // Signed in: go where this person actually works, rather than showing them a marketing page.
    if (user.role === 'doctor') redirect('/doctor/queue');
    if (user.role === 'clinical_admin' || user.role === 'platform_admin') redirect('/admin');
    redirect('/cases');
  }

  const steps = [
    { title: t('step1Title'), body: t('step1Body') },
    { title: t('step2Title'), body: t('step2Body') },
    { title: t('step3Title'), body: t('step3Body') },
  ];

  return (
    <div>
      <section className="gi-prose">
        <h1 className="text-3xl sm:text-4xl">{t('heading')}</h1>
        <p className="mt-4 text-lg text-ink-muted">{t('intro')}</p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/register" className="gi-button-primary">
            {t('getStarted')}
          </Link>
          <Link href="/login" className="gi-button-secondary">
            {t('signIn')}
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl">{t('howItWorks')}</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step.title} as="li">
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-faint font-semibold text-accent"
              >
                {index + 1}
              </span>
              <h3 className="mt-3 text-lg">{step.title}</h3>
              <p className="mt-1.5 text-ink-muted">{step.body}</p>
            </Card>
          ))}
        </ol>
      </section>
    </div>
  );
}
