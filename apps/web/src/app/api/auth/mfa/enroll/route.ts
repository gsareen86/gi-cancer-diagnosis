import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { database } from '@/server/db';
import { encryptField } from '@/server/crypto';
import { enrolmentUri, formatSecretForDisplay, generateSecret } from '@/server/auth/totp';
import { loadProfile } from '@/server/auth/accounts';
import { route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * Starts second-factor enrolment.
 *
 * Reachable from an enrolment-scoped session — the one a doctor, clinical admin, or platform
 * admin holds after signing in but before their second factor is satisfied. That session reaches
 * these endpoints and nothing else; in particular it cannot read any patient clinical data.
 *
 * The secret is stored encrypted and marked unconfirmed. It only becomes the account's factor
 * once a code generated from it comes back, which proves the authenticator actually holds it —
 * otherwise a mistyped scan would lock the account out permanently.
 */
export const POST = route({ allowMfaPending: true }, async ({ session }) => {
  const profile = await loadProfile(session.userId);
  if (!profile) return problem('not_found', 'error.not_found');

  const db = database();
  const [existing] = await db
    .select({ confirmedAt: tables.totpFactors.confirmedAt })
    .from(tables.totpFactors)
    .where(eq(tables.totpFactors.userId, session.userId))
    .limit(1);

  if (existing?.confirmedAt != null) {
    // Re-enrolling would silently invalidate a working authenticator. Resetting a confirmed
    // factor is a deliberate administrative act, not something a session can do to itself.
    return problem('conflict', 'auth.mfa.already_enrolled');
  }

  const secret = generateSecret();

  // Replace any unconfirmed attempt: an abandoned scan should not block a fresh one.
  await db.delete(tables.totpFactors).where(eq(tables.totpFactors.userId, session.userId));
  await db.insert(tables.totpFactors).values({
    userId: session.userId,
    secretEnc: encryptField(secret),
    confirmedAt: null,
  });

  return ok({
    // Both forms: the URI for a scan, the grouped secret for anyone typing it in.
    otpauthUri: enrolmentUri({ secretBase32: secret, accountEmail: profile.email }),
    secret: formatSecretForDisplay(secret),
  });
});
