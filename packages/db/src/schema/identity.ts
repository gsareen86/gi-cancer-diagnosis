import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { accountStatusEnum, roleEnum, tokenPurposeEnum } from './enums';

/**
 * Identity is the `users.id`, never the email address and never an external provider account —
 * which is what lets a Phase 2 Google or Facebook link attach to an existing patient instead of
 * creating a second one.
 *
 * Direct identifiers are held encrypted at the field level (the `*Enc` columns). The application
 * never writes plaintext into them.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicNumber: integer('public_number').generatedAlwaysAsIdentity({ startWith: 100001 }).notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default('patient'),
    status: accountStatusEnum('status').notNull().default('unverified'),

    fullNameEnc: text('full_name_enc'),
    phoneEnc: text('phone_enc'),
    dateOfBirth: date('date_of_birth'),
    sex: text('sex'),
    locale: text('locale').notNull().default('en'),

    emergencyContactNameEnc: text('emergency_contact_name_enc'),
    emergencyContactPhoneEnc: text('emergency_contact_phone_enc'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    erasedAt: timestamp('erased_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_key').on(table.email),
    uniqueIndex('users_public_number_key').on(table.publicNumber),
    index('users_role_status_idx').on(table.role, table.status),
  ],
);

export const externalIdentities = pgTable(
  'external_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    /** Only a provider-asserted verified email may auto-link to an existing account. */
    emailVerified: boolean('email_verified').notNull().default(false),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('external_identities_provider_key').on(table.provider, table.providerUserId),
    index('external_identities_user_idx').on(table.userId),
  ],
);

/**
 * One row per live refresh token. Rotation writes a new row in the same family and stamps
 * `rotatedAt` on the old one; presenting a rotated token is a replay and revokes the family.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    /** True until the second factor is satisfied; such a session reaches only MFA enrolment. */
    mfaPending: boolean('mfa_pending').notNull().default(false),
  },
  (table) => [
    uniqueIndex('sessions_refresh_hash_key').on(table.refreshTokenHash),
    index('sessions_user_idx').on(table.userId),
    index('sessions_family_idx').on(table.familyId),
  ],
);

export const oneTimeTokens = pgTable(
  'one_time_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: tokenPurposeEnum('purpose').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('one_time_tokens_hash_key').on(table.tokenHash),
    index('one_time_tokens_user_idx').on(table.userId, table.purpose),
  ],
);

export const totpFactors = pgTable('totp_factors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  secretEnc: text('secret_enc').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Only the hash of the email is kept, so the rate limiter is not a second directory of users. */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailHash: text('email_hash').notNull(),
    successful: boolean('successful').notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: text('ip_hash'),
  },
  (table) => [index('login_attempts_email_time_idx').on(table.emailHash, table.attemptedAt)],
);

/**
 * Break-glass. A platform admin has no default access to clinical content; an elevation is
 * time-limited, carries a stated reason, and both it and every read made under it are logged.
 */
export const adminElevations = pgTable(
  'admin_elevations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('admin_elevations_admin_idx').on(table.adminId, table.expiresAt)],
);
