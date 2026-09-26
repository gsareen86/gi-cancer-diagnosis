## Purpose

Allows invited clinic staff to authenticate with MFA and use sessions whose revocation and
inactivity deadlines are enforced by protected operations, including direct API access.

## ADDED Requirements

### Requirement: Invited accounts and mandatory second factor
The system SHALL allow only operator-provisioned staff accounts, reject self-registration
at Auth as well as the UI, and return generic failed-sign-in messages. TOTP enrolment and
verification SHALL be required before protected records. Password-only sessions SHALL NOT
access them through the UI or directly through the API.

#### Scenario: First sign-in
- **GIVEN** an invited active staff member without a factor
- **WHEN** they provide valid credentials
- **THEN** they must enrol and verify TOTP before protected data is available

#### Scenario: Registration or password-only bypass
- **WHEN** a visitor self-registers or a password-only session calls a protected API
- **THEN** registration or protected access is refused respectively

### Requirement: Current authority is checked at every protected operation
The system SHALL verify signed tokens and current staff/session state, MFA, revocation and
membership before protected access. Sign-out, account disablement and MFA recovery SHALL
prevent the next protected operation with old credentials, even before JWT expiry. A
membership removal SHALL deny subsequent access at that site.

#### Scenario: Captured token replay
- **GIVEN** a valid token captured before sign-out, account disablement or MFA recovery
- **WHEN** that token calls a protected operation after the corresponding revocation commits
- **THEN** no protected records are returned

#### Scenario: Tampered token
- **WHEN** a token is forged or expired
- **THEN** it is refused before protected content is returned

### Requirement: Idle and absolute deadlines are enforced server-side
The system SHALL enforce configurable inactivity and absolute session deadlines using server
time. Defaults SHALL be 15 minutes idle and eight hours absolute, recorded as operational
assumptions. Background polling and token refresh SHALL NOT extend activity. Touch or
bootstrap SHALL NOT revive an expired/revoked session; a new sign-in SHALL be required.

#### Scenario: Suspended browser
- **GIVEN** a session with no user activity past its idle deadline and paused client JavaScript
- **WHEN** its token calls a protected operation directly
- **THEN** the operation is refused even though the token signature is still valid

#### Scenario: Late renewal or polling
- **WHEN** background polls run, or an expired session requests renewal
- **THEN** polls do not extend the deadline and expired-session renewal is refused

#### Scenario: Active session reaches absolute expiry
- **WHEN** an otherwise active session reaches its absolute deadline
- **THEN** subsequent protected actions require a new sign-in

### Requirement: Shared-computer content is cleared
The system SHALL warn before idle expiry, support explicit sign-out, coordinate logout
across tabs and clear protected content on expiry/logout/Back navigation. It SHALL prevent
protected caching and persistent browser PHI storage. Offline sign-out SHALL clear local
content and distinguish pending server revocation from completed revocation.

#### Scenario: Sign-out then Back in another tab
- **WHEN** a staff member signs out and uses Back or switches to another open app tab
- **THEN** previously rendered protected content is cleared and sign-in is required

### Requirement: Public bootstrap remains limited and accessible
Landing/sign-in/MFA pages SHALL work without an existing application session. Public
bootstrap metadata SHALL contain only deployment identity/environment/schema version, never
PHI, staff membership or credentials. Protected metadata SHALL require the appropriate session.

#### Scenario: Pre-login startup
- **WHEN** an unauthenticated visitor opens the landing page
- **THEN** safe deployment verification does not require authentication or expose protected rows

### Requirement: Operator recovery is scoped and fail-closed
Staff lifecycle commands SHALL target only the designated synthetic project/users, record
operator identity/reason and require documented identity verification for recovery. Disabling
or recovery SHALL block app sessions before external Auth changes. Failures SHALL NOT silently
restore access, and repeat seed SHALL NOT reset passwords or factors.

#### Scenario: Wrong target or failed Auth recovery
- **WHEN** a recovery command names the wrong project/user or Auth administration fails
- **THEN** wrong-target mutation is refused or the intended account remains blocked respectively
- **AND** operator intent/outcome is recorded without secrets
