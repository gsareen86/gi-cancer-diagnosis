import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { MfaEnrolment } from '@/components/mfa-enrolment';
import { database } from '@/server/db';
import { currentUser } from '@/lib/session';
import { homePathFor } from '@/lib/guard';
import { safeNext, withNext } from '@/lib/navigation';

/**
 * Second-factor enrolment.
 *
 * A privileged account with an outstanding second factor holds an enrolment-scoped session: it
 * reaches this page and the MFA endpoints, and nothing else. In particular it cannot read any
 * patient clinical data — that is enforced in the API middleware, not by this redirect.
 *
 * Lives under `(auth)` rather than in a workspace precisely because a session in this state has
 * no workspace yet.
 */
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const t = await getTranslations('auth');
  const user = await currentUser();
  if (user === null) redirect(withNext('/login', next));
  if (!user.mfaPending) redirect(next ?? homePathFor(user.role));

  const [factor] = await database()
    .select({ confirmedAt: tables.totpFactors.confirmedAt })
    .from(tables.totpFactors)
    .where(eq(tables.totpFactors.userId, user.id))
    .limit(1);

  const alreadyEnrolled = factor?.confirmedAt != null;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {alreadyEnrolled ? t('mfaSignInHeading') : t('mfaHeading')}
      </h1>
      <p className="mt-2 text-ink-muted">
        {alreadyEnrolled ? t('mfaSignInBody') : t('mfaBody')}
      </p>
      <div className="mt-7">
        <MfaEnrolment alreadyEnrolled={alreadyEnrolled} nextPath={next} />
      </div>
    </div>
  );
}
