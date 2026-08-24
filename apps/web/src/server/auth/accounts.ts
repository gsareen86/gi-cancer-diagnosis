import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { database } from '../db';
import { hashPassword, hashToken, newToken, verifyPassword } from '../crypto';
import { checkPassword, type PasswordProblem } from './password-policy';
import { revokeAllSessions } from './session';

/**
 * Account lifecycle: registration, email verification, credential checking, password reset.
 *
 * A recurring rule here: an unauthenticated caller must never learn whether an email address has
 * an account. Registration and password reset therefore return the same shape whether or not the
 * address exists, and only the side effects differ.
 */

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const MAX_FAILED_LOGINS = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type RegistrationResult =
  | { status: 'created'; userId: string; verificationToken: string }
  /** Returned when the address already exists. The caller must respond identically to 'created'. */
  | { status: 'already_exists' }
  | { status: 'rejected'; problems: PasswordProblem[] };

export async function registerPatient(input: {
  email: string;
  password: string;
}): Promise<RegistrationResult> {
  const email = normalizeEmail(input.email);
  const problems = checkPassword(input.password, email);
  if (problems.length > 0) return { status: 'rejected', problems };

  const db = database();
  const [existing] = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.email, email))
    .limit(1);
  if (existing) return { status: 'already_exists' };

  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(tables.users)
    // The role is fixed here, never taken from the request: self-registration always yields a
    // patient, and every other role is granted by a platform admin.
    .values({ email, passwordHash, role: 'patient', status: 'unverified' })
    .returning({ id: tables.users.id });
  if (!created) throw new Error('registration insert returned nothing');

  const token = await issueOneTimeToken(created.id, 'email_verification', VERIFICATION_TOKEN_TTL_MS);
  return { status: 'created', userId: created.id, verificationToken: token };
}

export async function issueOneTimeToken(
  userId: string,
  purpose: 'email_verification' | 'password_reset',
  ttlMs: number,
): Promise<string> {
  const token = newToken();
  await database()
    .insert(tables.oneTimeTokens)
    .values({
      userId,
      purpose,
      // Only the hash is stored: a database dump must not yield working verification links.
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    });
  return token;
}

export type TokenConsumption =
  | { status: 'consumed'; userId: string }
  | { status: 'invalid' };

async function consumeToken(
  token: string,
  purpose: 'email_verification' | 'password_reset',
): Promise<TokenConsumption> {
  const db = database();
  const [row] = await db
    .select()
    .from(tables.oneTimeTokens)
    .where(
      and(
        eq(tables.oneTimeTokens.tokenHash, hashToken(token)),
        eq(tables.oneTimeTokens.purpose, purpose),
        isNull(tables.oneTimeTokens.consumedAt),
        gt(tables.oneTimeTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return { status: 'invalid' };

  // Conditional update so two concurrent presentations cannot both succeed.
  const consumed = await db
    .update(tables.oneTimeTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(tables.oneTimeTokens.id, row.id), isNull(tables.oneTimeTokens.consumedAt)))
    .returning({ id: tables.oneTimeTokens.id });
  if (consumed.length === 0) return { status: 'invalid' };

  return { status: 'consumed', userId: row.userId };
}

export async function verifyEmail(token: string): Promise<TokenConsumption> {
  const result = await consumeToken(token, 'email_verification');
  if (result.status !== 'consumed') return result;
  await database()
    .update(tables.users)
    .set({ status: 'active', updatedAt: new Date() })
    .where(and(eq(tables.users.id, result.userId), eq(tables.users.status, 'unverified')));
  return result;
}

export type ResetRequest =
  | { status: 'issued'; userId: string; token: string }
  /** No account, or an account that cannot be reset. Respond identically to 'issued'. */
  | { status: 'no_account' };

export async function requestPasswordReset(email: string): Promise<ResetRequest> {
  const [user] = await database()
    .select({ id: tables.users.id, status: tables.users.status })
    .from(tables.users)
    .where(eq(tables.users.email, normalizeEmail(email)))
    .limit(1);
  if (!user || user.status === 'erased') return { status: 'no_account' };

  const token = await issueOneTimeToken(user.id, 'password_reset', RESET_TOKEN_TTL_MS);
  return { status: 'issued', userId: user.id, token };
}

export type ResetOutcome =
  | { status: 'reset'; userId: string }
  | { status: 'invalid_token' }
  | { status: 'rejected'; problems: PasswordProblem[] };

export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const problems = checkPassword(newPassword);
  if (problems.length > 0) return { status: 'rejected', problems };

  const consumption = await consumeToken(token, 'password_reset');
  if (consumption.status !== 'consumed') return { status: 'invalid_token' };

  await database()
    .update(tables.users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(tables.users.id, consumption.userId));

  // Whoever held a session before the reset may be the reason it was needed.
  await revokeAllSessions(consumption.userId);
  return { status: 'reset', userId: consumption.userId };
}

/* -------------------------------------------------------------------------------------------- */
/* Credential checking and rate limiting                                                         */
/* -------------------------------------------------------------------------------------------- */

export type CredentialOutcome =
  | { status: 'ok'; userId: string; role: 'patient' | 'doctor' | 'clinical_admin' | 'platform_admin'; mfaRequired: boolean; mfaEnrolled: boolean }
  | { status: 'invalid' }
  | { status: 'unverified' }
  | { status: 'suspended' }
  | { status: 'rate_limited'; retryAfterSeconds: number };

/** Roles that hold or govern patient clinical data must carry a second factor. */
export const MFA_REQUIRED_ROLES = ['doctor', 'clinical_admin', 'platform_admin'] as const;

export async function checkCredentials(
  email: string,
  password: string,
  ipHash: string | null,
): Promise<CredentialOutcome> {
  const db = database();
  const normalized = normalizeEmail(email);
  const emailHash = hashToken(normalized);

  const [failures] = await db
    .select({ value: count() })
    .from(tables.loginAttempts)
    .where(
      and(
        eq(tables.loginAttempts.emailHash, emailHash),
        eq(tables.loginAttempts.successful, false),
        gt(tables.loginAttempts.attemptedAt, new Date(Date.now() - LOGIN_WINDOW_MS)),
      ),
    );

  if ((failures?.value ?? 0) >= MAX_FAILED_LOGINS) {
    await recordAttempt(emailHash, false, ipHash);
    return { status: 'rate_limited', retryAfterSeconds: Math.ceil(LOGIN_WINDOW_MS / 1000) };
  }

  const [user] = await db
    .select({
      id: tables.users.id,
      passwordHash: tables.users.passwordHash,
      role: tables.users.role,
      status: tables.users.status,
    })
    .from(tables.users)
    .where(eq(tables.users.email, normalized))
    .limit(1);

  // Verify against a decoy hash when the account is unknown, so a missing account and a wrong
  // password take comparable time.
  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(DECOY_HASH, password);

  await recordAttempt(emailHash, valid && user !== undefined, ipHash);

  if (!user || !valid) return { status: 'invalid' };
  if (user.status === 'unverified') return { status: 'unverified' };
  if (user.status !== 'active') return { status: 'suspended' };

  const mfaRequired = (MFA_REQUIRED_ROLES as readonly string[]).includes(user.role);
  const [factor] = await db
    .select({ confirmedAt: tables.totpFactors.confirmedAt })
    .from(tables.totpFactors)
    .where(eq(tables.totpFactors.userId, user.id))
    .limit(1);

  return {
    status: 'ok',
    userId: user.id,
    role: user.role,
    mfaRequired,
    mfaEnrolled: factor?.confirmedAt != null,
  };
}

/**
 * A fixed Argon2id hash of a random string nobody knows. Verifying against it when the account
 * does not exist keeps the timing of "no such account" close to "wrong password".
 */
const DECOY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$Z2ktY29tcGFzcy1kZWNveQ$0Fh1t3RCjJ1uK0Vx4JZ8QpQm6l3sVzT2n8Kx1yQ0bXo';

async function recordAttempt(
  emailHash: string,
  successful: boolean,
  ipHash: string | null,
): Promise<void> {
  await database().insert(tables.loginAttempts).values({ emailHash, successful, ipHash });
}

export async function loadProfile(userId: string) {
  const [row] = await database()
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .limit(1);
  return row ?? null;
}
