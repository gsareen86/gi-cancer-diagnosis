## Purpose

Establishes one durable identity per person on the platform and proves that a request belongs to
that person, so that clinical data can be attributed and access-controlled. Phase 1 authenticates
with email and password; later social sign-in methods link into the same identity rather than
creating a second one.

## ADDED Requirements

### Requirement: Patient self-registration with verified email

The system SHALL allow a person to register as a patient with an email address and a password, and
SHALL treat the account as unverified until the person proves control of that email address. An
unverified account MUST NOT be able to create a case, submit answers, or upload documents.

#### Scenario: Successful registration

- **WHEN** a visitor submits a well-formed, unused email address and a password that meets policy
- **THEN** the system creates a patient account in the `unverified` state, sends a verification
  message containing a single-use token valid for 24 hours, and does not establish a session

#### Scenario: Email already registered

- **WHEN** a visitor submits an email address that already has an account
- **THEN** the system responds with the same generic success message as a new registration and sends
  no new account creation, so that account existence is not disclosed to an unauthenticated caller

#### Scenario: Verification completes

- **WHEN** the account holder presents an unexpired, unused verification token
- **THEN** the system marks the account `active`, consumes the token so it cannot be reused, and
  records an audit entry with actor, action `account.verified`, and timestamp

#### Scenario: Unverified account is blocked from clinical actions

- **WHEN** an `unverified` account attempts to create a case or upload a document
- **THEN** the system refuses with a `403` and records the refusal in the audit log

### Requirement: Password storage and policy

The system SHALL store passwords only as Argon2id hashes with per-password salts and MUST NOT store,
log, or transmit a password in recoverable form. The system SHALL reject passwords shorter than 12
characters and SHALL reject passwords appearing in a known-breached-password list.

#### Scenario: Weak password rejected

- **WHEN** a person submits a password of fewer than 12 characters, or one on the breached list
- **THEN** registration fails with a message naming the unmet rule and no account is created

#### Scenario: Password never appears in logs

- **WHEN** any authentication request is processed, successfully or not
- **THEN** no log record, audit entry, or error report contains the submitted password or its hash

### Requirement: Session issuance and refresh

The system SHALL issue a short-lived access token (15 minutes or less) and a longer-lived refresh
token on successful authentication. Refresh tokens SHALL be delivered as `httpOnly`, `Secure`,
`SameSite=Lax` cookies, SHALL be rotated on every use, and a reused (already-rotated) refresh token
SHALL invalidate the entire session family.

#### Scenario: Successful login

- **WHEN** an `active` account submits correct credentials
- **THEN** the system issues an access token and a rotating refresh token cookie, and records an
  audit entry `session.created` with actor, IP metadata, and timestamp

#### Scenario: Refresh token replay

- **WHEN** a refresh token that has already been rotated is presented again
- **THEN** the system rejects it, revokes every session descended from that family, and records an
  audit entry `session.replay_detected`

#### Scenario: Failed login rate limiting

- **WHEN** more than 10 failed attempts occur for one email address within 15 minutes
- **THEN** further attempts for that address are refused for a cooling-off period and each refusal is
  audit-logged

### Requirement: Password reset via single-use token

The system SHALL allow a person to request a password reset that is delivered only to the registered
email address, using a signed single-use token valid for no more than 60 minutes. Completing a reset
SHALL invalidate all existing sessions for that account.

#### Scenario: Reset requested for an unknown address

- **WHEN** a reset is requested for an address with no account
- **THEN** the system responds identically to the known-address case and sends no email, so account
  existence is not disclosed

#### Scenario: Reset completes

- **WHEN** the account holder presents a valid reset token with a policy-compliant new password
- **THEN** the password hash is replaced, the token is consumed, all sessions are revoked, and an
  audit entry `password.reset` is recorded

### Requirement: Second factor for privileged roles

The system SHALL support TOTP-based multi-factor authentication and SHALL require it for accounts
holding the doctor, clinical-admin, or platform-admin role.

#### Scenario: Doctor without MFA enrolled

- **WHEN** a doctor account authenticates with a correct password but has no TOTP factor enrolled
- **THEN** the system grants only an enrolment-scoped session that can reach the MFA enrolment
  endpoints and nothing else, and in particular cannot read any patient clinical data

#### Scenario: Doctor completes second factor

- **WHEN** an enrolled doctor supplies a valid, unexpired TOTP code
- **THEN** a full session is issued and an audit entry `session.mfa_verified` is recorded

### Requirement: Identity is stable across future sign-in methods

An account SHALL be identified by a stable internal identifier, not by its email address or by any
external provider identifier. The account model SHALL carry a collection of linked external identity
records so that a later Google or Facebook sign-in attaches to the existing account when it presents
a provider-verified email that matches a verified account email.

#### Scenario: Provider link attaches to existing identity

- **WHEN** a sign-in method is linked using an email address the provider asserts as verified and
  which matches an existing verified account
- **THEN** the link is attached to that existing account and no second patient identity is created

#### Scenario: Provider email is unverified

- **WHEN** a link is attempted with a provider email the provider does not assert as verified
- **THEN** the system refuses to auto-link and requires the account holder to confirm ownership by
  the platform's own email verification flow

### Requirement: Adults only in Phase 1

The system SHALL require a date of birth at profile completion and SHALL refuse to open a case for a
person under 18 years of age, because processing a child's data under the DPDP Act requires
verifiable parental consent that Phase 1 does not implement.

#### Scenario: Minor attempts to open a case

- **WHEN** a person whose recorded date of birth places them under 18 attempts to create a case
- **THEN** the system refuses, explains that the service is currently for adults, and directs them to
  seek care directly, recording the refusal in the audit log
