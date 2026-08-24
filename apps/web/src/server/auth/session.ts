import { randomUUID } from 'node:crypto';
import { and, eq, isNull, gt, sql } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { tables } from '@gi-compass/db';
import { database } from '../db';
import { env } from '../env';
import { hashToken, newToken } from '../crypto';

/**
 * Sessions: a short-lived access token the client sends, and a rotating refresh token held in an
 * httpOnly cookie.
 *
 * Rotation is what makes theft detectable. Every refresh mints a new token and stamps the old
 * one as rotated; presenting a rotated token means two parties hold it, so the whole family is
 * revoked rather than the single token.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;

export const ACCESS_COOKIE = 'gi_access';
export const REFRESH_COOKIE = 'gi_refresh';

export type SessionRole = 'patient' | 'doctor' | 'clinical_admin' | 'platform_admin';

export interface AccessClaims {
  sub: string;
  role: SessionRole;
  sid: string;
  /** True while the second factor is outstanding: such a session reaches only MFA enrolment. */
  mfaPending: boolean;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, sid: claims.sid, mfaPending: claims.mfaPending })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer('gi-compass')
    .setAudience('gi-compass-app')
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: 'gi-compass',
      audience: 'gi-compass-app',
    });
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;
    return {
      sub: payload.sub,
      role: payload.role as SessionRole,
      sid: String(payload.sid ?? ''),
      mfaPending: payload.mfaPending === true,
    };
  } catch {
    return null;
  }
}

export interface IssuedSession {
  sessionId: string;
  familyId: string;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export async function createSession(options: {
  userId: string;
  role: SessionRole;
  mfaPending: boolean;
  familyId?: string;
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<IssuedSession> {
  const db = database();
  const refreshToken = newToken();
  const familyId = options.familyId ?? randomUUID();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const [row] = await db
    .insert(tables.sessions)
    .values({
      userId: options.userId,
      familyId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
      ipHash: options.ipHash ?? null,
      userAgent: options.userAgent ?? null,
      mfaPending: options.mfaPending,
    })
    .returning({ id: tables.sessions.id });
  if (!row) throw new Error('session creation failed');

  const accessToken = await signAccessToken({
    sub: options.userId,
    role: options.role,
    sid: row.id,
    mfaPending: options.mfaPending,
  });

  return { sessionId: row.id, familyId, accessToken, refreshToken, refreshExpiresAt };
}

export type RefreshOutcome =
  | { status: 'rotated'; session: IssuedSession }
  | { status: 'replay_detected'; familyId: string; userId: string }
  | { status: 'unknown' };

/**
 * Rotates a refresh token.
 *
 * A token that is already rotated, revoked, or expired is not merely rejected: if it was
 * rotated, someone is replaying a token we already retired, so every session descended from
 * that family is revoked.
 */
export async function rotateRefreshToken(
  presented: string,
  context: { ipHash?: string | null; userAgent?: string | null } = {},
): Promise<RefreshOutcome> {
  const db = database();
  const tokenHash = hashToken(presented);

  const [existing] = await db
    .select()
    .from(tables.sessions)
    .where(eq(tables.sessions.refreshTokenHash, tokenHash))
    .limit(1);

  if (!existing) return { status: 'unknown' };

  if (existing.rotatedAt !== null || existing.revokedAt !== null) {
    await revokeFamily(existing.familyId);
    return { status: 'replay_detected', familyId: existing.familyId, userId: existing.userId };
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await db
      .update(tables.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(tables.sessions.id, existing.id));
    return { status: 'unknown' };
  }

  const [user] = await db
    .select({ role: tables.users.role, status: tables.users.status })
    .from(tables.users)
    .where(eq(tables.users.id, existing.userId))
    .limit(1);
  if (!user || user.status !== 'active') {
    await revokeFamily(existing.familyId);
    return { status: 'unknown' };
  }

  await db
    .update(tables.sessions)
    .set({ rotatedAt: new Date() })
    .where(eq(tables.sessions.id, existing.id));

  const session = await createSession({
    userId: existing.userId,
    role: user.role,
    mfaPending: existing.mfaPending,
    familyId: existing.familyId,
    ipHash: context.ipHash ?? null,
    userAgent: context.userAgent ?? null,
  });
  return { status: 'rotated', session };
}

export async function revokeFamily(familyId: string): Promise<void> {
  await database()
    .update(tables.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(tables.sessions.familyId, familyId), isNull(tables.sessions.revokedAt)));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await database()
    .update(tables.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(tables.sessions.userId, userId), isNull(tables.sessions.revokedAt)));
}

/** A session is live only while its row is neither revoked nor expired. */
export async function isSessionLive(sessionId: string): Promise<boolean> {
  const [row] = await database()
    .select({ id: tables.sessions.id })
    .from(tables.sessions)
    .where(
      and(
        eq(tables.sessions.id, sessionId),
        isNull(tables.sessions.revokedAt),
        gt(tables.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function markMfaSatisfied(sessionId: string): Promise<void> {
  await database()
    .update(tables.sessions)
    .set({ mfaPending: false })
    .where(eq(tables.sessions.id, sessionId));
}

/** Housekeeping: sessions that expired long ago are not evidence of anything. */
export async function pruneExpiredSessions(olderThanDays = 30): Promise<number> {
  const result = await database().execute(
    sql`DELETE FROM sessions WHERE expires_at < now() - make_interval(days => ${olderThanDays})`,
  );
  return result.rowCount ?? 0;
}
