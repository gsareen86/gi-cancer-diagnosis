import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { database } from '../src/server/db';
import { hashPassword } from '../src/server/crypto';
import { checkPassword } from '../src/server/auth/password-policy';

/**
 * Account administration from the command line.
 *
 * Roles are never self-selected: registration always yields a patient, and every other role is
 * granted deliberately. That left no way at all to create the first doctor — the seeded
 * platform admin exists to own the seeded content and carries an unusable password hash, so it
 * cannot be signed into. This is the documented way in.
 *
 *   npm run user -- create  doctor  doctor@example.com
 *   npm run user -- grant   doctor  someone@example.com
 *   npm run user -- reset-mfa       doctor@example.com   (destroys a working authenticator)
 *   npm run user -- list
 *
 * Nothing here bypasses a clinical control. It creates accounts and assigns roles; the second
 * factor still has to be enrolled through the interface, and no clinical data is touched.
 */

type Role = 'patient' | 'doctor' | 'clinical_admin' | 'platform_admin';

const ROLES: readonly Role[] = ['patient', 'doctor', 'clinical_admin', 'platform_admin'];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

function usage(): never {
  console.error(
    [
      '',
      'Usage:',
      '  npm run user -- create <role> <email> [password]   create an account, already verified',
      '  npm run user -- grant <role> <email>               change an existing account\'s role',
      '  npm run user -- reset-mfa <email>                  clear the second factor so it can be re-enrolled',
      '  npm run user -- list                               show every account',
      '',
      `Roles: ${ROLES.join(', ')}`,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

/** Long enough that it is not worth guessing, and printed once for the operator to hand over. */
function generatePassword(): string {
  return `${randomBytes(12).toString('base64url')}-gi`;
}

async function create(role: Role, email: string, supplied?: string): Promise<void> {
  const db = database();
  const normalized = email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.email, normalized))
    .limit(1);

  if (existing) {
    console.error(`An account already exists for ${normalized}. Use "grant" to change its role.`);
    process.exit(1);
  }

  const password = supplied ?? generatePassword();
  const problems = checkPassword(password, normalized);
  if (problems.length > 0) {
    console.error(`That password is not acceptable: ${problems.map((p) => p.code).join(', ')}`);
    process.exit(1);
  }

  await db.insert(tables.users).values({
    email: normalized,
    passwordHash: await hashPassword(password),
    role,
    // Created by an administrator who already knows who this is, so there is no address to
    // prove control of. A self-registered patient still goes through verification.
    status: 'active',
  });

  console.log('');
  console.log(`  Created ${role}: ${normalized}`);
  if (supplied === undefined) console.log(`  Password: ${password}`);
  console.log('');
  if (role !== 'patient') {
    console.log('  This account needs a second factor before it can see anything.');
    console.log('  Sign in and the app will walk through enrolment.');
    console.log('');
  }
}

async function grant(role: Role, email: string): Promise<void> {
  const db = database();
  const normalized = email.trim().toLowerCase();

  const [user] = await db
    .select({ id: tables.users.id, role: tables.users.role })
    .from(tables.users)
    .where(eq(tables.users.email, normalized))
    .limit(1);

  if (!user) {
    console.error(`No account for ${normalized}.`);
    process.exit(1);
  }

  await db.update(tables.users).set({ role }).where(eq(tables.users.id, user.id));
  console.log(`  ${normalized}: ${user.role} -> ${role}`);

  if (role !== 'patient') {
    // The role check reads the database on every request, so this takes effect immediately —
    // but the second factor is a separate gate the account has not passed yet.
    console.log('  Sign in again to enrol a second factor.');
  }
}

async function resetMfa(email: string): Promise<void> {
  const db = database();
  const normalized = email.trim().toLowerCase();

  const [user] = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.email, normalized))
    .limit(1);

  if (!user) {
    console.error(`No account for ${normalized}.`);
    process.exit(1);
  }

  const removed = await db
    .delete(tables.totpFactors)
    .where(eq(tables.totpFactors.userId, user.id))
    .returning({ id: tables.totpFactors.id });

  if (removed.length === 0) {
    console.log(`  ${normalized} had no second factor. Nothing changed.`);
    return;
  }

  console.log('');
  console.log(`  Cleared the second factor for ${normalized}.`);
  console.log('');
  // Stated plainly because it is not recoverable: whatever is in that authenticator app is now
  // useless, and the only way back is to enrol again.
  console.log('  Any code in their authenticator app will now be rejected. They must delete the');
  console.log('  old "GI Compass" entry and enrol again at the next sign-in.');
  console.log('');
}

async function list(): Promise<void> {
  const db = database();
  const users = await db
    .select({
      id: tables.users.id,
      email: tables.users.email,
      role: tables.users.role,
      status: tables.users.status,
    })
    .from(tables.users)
    .orderBy(tables.users.createdAt);

  if (users.length === 0) {
    console.log('  No accounts yet.');
    return;
  }

  const factors = await db
    .select({
      userId: tables.totpFactors.userId,
      confirmedAt: tables.totpFactors.confirmedAt,
      createdAt: tables.totpFactors.createdAt,
    })
    .from(tables.totpFactors);

  console.log('');
  for (const user of users) {
    const factor = factors.find((entry) => entry.userId === user.id);
    // When a factor was enrolled matters: if it is newer than the authenticator entry someone is
    // holding, their codes will be rejected and the reason is otherwise invisible.
    const mfa =
      factor === undefined
        ? user.role === 'patient'
          ? '—'
          : 'not enrolled'
        : factor.confirmedAt === null
          ? 'enrolment started'
          : `enrolled ${factor.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`;

    console.log(
      `  ${user.role.padEnd(15)} ${user.status.padEnd(11)} ${mfa.padEnd(24)} ${user.email}`,
    );
  }
  console.log('');
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'create': {
      const [role, email, password] = rest;
      if (role === undefined || !isRole(role) || email === undefined) usage();
      await create(role, email, password);
      return;
    }
    case 'grant': {
      const [role, email] = rest;
      if (role === undefined || !isRole(role) || email === undefined) usage();
      await grant(role, email);
      return;
    }
    case 'reset-mfa': {
      const [email] = rest;
      if (email === undefined) usage();
      await resetMfa(email);
      return;
    }
    case 'list':
      await list();
      return;
    default:
      usage();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
