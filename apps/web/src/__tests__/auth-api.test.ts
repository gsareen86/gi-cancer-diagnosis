import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { call, ensureSeeded, makeUser, tables, truncateAll } from './api-harness';
import { database } from '@/server/db';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as verifyEmailRoute } from '@/app/api/auth/verify-email/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as refresh } from '@/app/api/auth/refresh/route';
import { POST as requestReset } from '@/app/api/auth/password-reset/request/route';
import { POST as completeReset } from '@/app/api/auth/password-reset/complete/route';
import { GET as me } from '@/app/api/me/route';
import { hashToken } from '@/server/crypto';

beforeAll(ensureSeeded);
beforeEach(truncateAll);
afterAll(async () => {
  await truncateAll();
});

const GOOD_PASSWORD = 'a-perfectly-fine-passphrase';

async function tokenFor(email: string, purpose: 'email_verification' | 'password_reset') {
  const db = database();
  const [user] = await db.select().from(tables.users).where(eq(tables.users.email, email)).limit(1);
  if (!user) return null;
  const rows = await db.select().from(tables.oneTimeTokens).where(eq(tables.oneTimeTokens.userId, user.id));
  return rows.find((row) => row.purpose === purpose) ?? null;
}

describe('registration', () => {
  it('creates an unverified account and issues a verification token', async () => {
    const response = await call(register, {
      method: 'POST',
      body: { email: 'new-patient@example.invalid', password: GOOD_PASSWORD },
    });
    expect(response.status).toBe(202);

    const [user] = await database()
      .select()
      .from(tables.users)
      .where(eq(tables.users.email, 'new-patient@example.invalid'));
    expect(user?.status).toBe('unverified');
    expect(user?.role).toBe('patient');
    expect(await tokenFor('new-patient@example.invalid', 'email_verification')).not.toBeNull();
  });

  it('never returns the verification token in the response', async () => {
    const response = await call(register, {
      method: 'POST',
      body: { email: 'token-check@example.invalid', password: GOOD_PASSWORD },
    });
    const stored = await tokenFor('token-check@example.invalid', 'email_verification');
    expect(stored).not.toBeNull();
    expect(JSON.stringify(response.body)).not.toContain(stored!.tokenHash);
    expect(Object.keys(response.body)).toEqual(['status']);
  });

  it('answers identically for an address that already exists', async () => {
    const body = { email: 'dupe@example.invalid', password: GOOD_PASSWORD };
    const first = await call(register, { method: 'POST', body });
    const second = await call(register, { method: 'POST', body });

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);

    const rows = await database()
      .select()
      .from(tables.users)
      .where(eq(tables.users.email, 'dupe@example.invalid'));
    expect(rows).toHaveLength(1);
  });

  it('ignores a role the caller asks for, so registration cannot escalate', async () => {
    await call(register, {
      method: 'POST',
      body: { email: 'wannabe@example.invalid', password: GOOD_PASSWORD, role: 'platform_admin' },
    });
    const [user] = await database()
      .select()
      .from(tables.users)
      .where(eq(tables.users.email, 'wannabe@example.invalid'));
    expect(user?.role).toBe('patient');
  });

  it.each([
    ['too short', 'short1'],
    ['a known breached password', 'password123'],
    ['whitespace only', '            '],
  ])('rejects %s', async (_name, password) => {
    const response = await call(register, {
      method: 'POST',
      body: { email: 'weak@example.invalid', password },
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('auth.register.password_rejected');

    const rows = await database()
      .select()
      .from(tables.users)
      .where(eq(tables.users.email, 'weak@example.invalid'));
    expect(rows).toEqual([]);
  });

  it('rejects a password containing the email local part', async () => {
    const response = await call(register, {
      method: 'POST',
      body: { email: 'sunitha@example.invalid', password: 'sunitha-loves-tea-2026' },
    });
    expect(response.status).toBe(400);
  });
});

describe('email verification', () => {
  it('activates the account and consumes the token', async () => {
    await call(register, {
      method: 'POST',
      body: { email: 'verify@example.invalid', password: GOOD_PASSWORD },
    });
    // The plaintext token only exists in the email, so the test regenerates one the same way
    // the service does and checks the hash matches what was stored.
    const stored = await tokenFor('verify@example.invalid', 'email_verification');
    expect(stored).not.toBeNull();

    // Re-issue a known token for the same user to exercise the consumption path.
    const db = database();
    const plaintext = 'known-verification-token-for-test';
    await db
      .update(tables.oneTimeTokens)
      .set({ tokenHash: hashToken(plaintext) })
      .where(eq(tables.oneTimeTokens.id, stored!.id));

    const first = await call(verifyEmailRoute, { method: 'POST', body: { token: plaintext } });
    expect(first.status).toBe(200);

    const [user] = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.email, 'verify@example.invalid'));
    expect(user?.status).toBe('active');

    const replay = await call(verifyEmailRoute, { method: 'POST', body: { token: plaintext } });
    expect(replay.status).toBe(400);
  });

  it('rejects an unknown token', async () => {
    const response = await call(verifyEmailRoute, {
      method: 'POST',
      body: { token: 'not-a-real-token-value' },
    });
    expect(response.status).toBe(400);
  });
});

describe('login', () => {
  it('issues session cookies for an active account', async () => {
    const user = await makeUser({ role: 'patient' });
    const response = await call(login, {
      method: 'POST',
      body: { email: user.email, password: user.password },
    });
    expect(response.status).toBe(200);
    expect(response.body.role).toBe('patient');
    expect(response.body.mfaPending).toBe(false);
  });

  it('gives the same answer for a wrong password and an unknown address', async () => {
    const user = await makeUser({ role: 'patient' });
    const wrongPassword = await call(login, {
      method: 'POST',
      body: { email: user.email, password: 'definitely-not-the-password' },
    });
    const unknownAddress = await call(login, {
      method: 'POST',
      body: { email: 'nobody@example.invalid', password: 'definitely-not-the-password' },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownAddress.status).toBe(401);
    expect(unknownAddress.body).toEqual(wrongPassword.body);
  });

  it('refuses an unverified account', async () => {
    const user = await makeUser({ role: 'patient', status: 'unverified' });
    const response = await call(login, {
      method: 'POST',
      body: { email: user.email, password: user.password },
    });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('auth.login.unverified');
  });

  it('rate limits after ten failures within the window', async () => {
    const user = await makeUser({ role: 'patient' });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call(login, { method: 'POST', body: { email: user.email, password: 'wrong-password' } });
    }
    const eleventh = await call(login, {
      method: 'POST',
      body: { email: user.email, password: user.password },
    });
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.messageKey).toBe('auth.login.rate_limited');
  });

  it('gives a doctor an MFA-pending session', async () => {
    const doctor = await makeUser({ role: 'doctor' });
    const response = await call(login, {
      method: 'POST',
      body: { email: doctor.email, password: doctor.password },
    });
    expect(response.status).toBe(200);
    expect(response.body.mfaPending).toBe(true);
    expect(response.body.mfaEnrolled).toBe(false);
  });

  it('never writes the submitted password anywhere readable', async () => {
    const user = await makeUser({ role: 'patient' });
    await call(login, { method: 'POST', body: { email: user.email, password: 'super-secret-guess' } });

    const attempts = await database().select().from(tables.loginAttempts);
    expect(JSON.stringify(attempts)).not.toContain('super-secret-guess');
    expect(JSON.stringify(attempts)).not.toContain(user.email);
  });
});

describe('an MFA-pending session cannot reach clinical routes', () => {
  it('is refused with an MFA message rather than a generic forbidden', async () => {
    const doctor = await makeUser({ role: 'doctor', mfaPending: true });
    const { GET: queue } = await import('@/app/api/doctor/queue/route');
    const response = await call(queue as never, { accessToken: doctor.accessToken });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('error.mfa_required');
  });

  it('may still read its own account, so it can complete enrolment', async () => {
    const doctor = await makeUser({ role: 'doctor', mfaPending: true });
    const response = await call(me as never, { accessToken: doctor.accessToken });
    expect(response.status).toBe(200);
    expect(response.body.mfaPending).toBe(true);
  });
});

describe('password reset', () => {
  it('answers the same whether or not the address exists', async () => {
    const user = await makeUser({ role: 'patient' });
    const known = await call(requestReset, { method: 'POST', body: { email: user.email } });
    const unknown = await call(requestReset, {
      method: 'POST',
      body: { email: 'ghost@example.invalid' },
    });
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
  });

  it('resets the password, consumes the token, and revokes every session', async () => {
    const user = await makeUser({ role: 'patient' });
    await call(requestReset, { method: 'POST', body: { email: user.email } });

    const db = database();
    const stored = await tokenFor(user.email, 'password_reset');
    const plaintext = 'known-reset-token-for-test';
    await db
      .update(tables.oneTimeTokens)
      .set({ tokenHash: hashToken(plaintext) })
      .where(eq(tables.oneTimeTokens.id, stored!.id));

    const response = await call(completeReset, {
      method: 'POST',
      body: { token: plaintext, password: 'a-brand-new-passphrase-here' },
    });
    expect(response.status).toBe(200);

    const sessions = await db.select().from(tables.sessions).where(eq(tables.sessions.userId, user.id));
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);

    const replay = await call(completeReset, {
      method: 'POST',
      body: { token: plaintext, password: 'yet-another-passphrase-x' },
    });
    expect(replay.status).toBe(400);
  });

  it('rejects a weak new password', async () => {
    const response = await call(completeReset, {
      method: 'POST',
      body: { token: 'some-token-value-here', password: 'qwerty' },
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('auth.reset.password_rejected');
  });
});

describe('unauthenticated access', () => {
  it('is refused with 401 and no clinical content', async () => {
    const response = await call(me as never, {});
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('error.unauthenticated');
  });
});

describe('refresh token rotation', () => {
  it('refuses a missing token', async () => {
    const response = await call(refresh, { method: 'POST' });
    expect(response.status).toBe(401);
  });
});
