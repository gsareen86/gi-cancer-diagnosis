## Purpose

Make phone access and caregiver assistance possible without confusing account ownership with patient identity.

## ADDED Requirements

### Requirement: Existing authentication remains available while mobile OTP is deferred

The application SHALL retain existing email/password authentication, verification and recovery. Mobile OTP/provider integration SHALL remain deferred and SHALL NOT be advertised as available. A shared household identity SHALL NOT imply shared clinical access.

#### Scenario: Existing patient signs in

- **WHEN** an existing user authenticates or completes authorized account recovery
- **THEN** their original account and permitted records remain accessible with authentication events audited without logging credentials

#### Scenario: Clinical access is still scoped

- **WHEN** an authenticated household member requests another adult's clinical record
- **THEN** patient-specific authority and consent are checked, unauthorized content is refused, and the access attempt is audited

#### Scenario: Login is unavailable

- **WHEN** verification or recovery delivery is unavailable
- **THEN** no successful login/submission is claimed and approved immediate-care guidance remains available

### Requirement: Caregiver access records separate actor and patient

The system SHALL represent patient subjects separately from login accounts and SHALL require a reviewed authorization/consent basis for adult caregiver access. Each action SHALL retain the submitting actor and patient subject.

#### Scenario: Authorized proxy

- **WHEN** a caregiver with an active permitted scope completes an intake
- **THEN** the case belongs to the patient subject and answers are attributed to the caregiver

#### Scenario: Relationship is insufficient

- **WHEN** a user states that they are a patient's child but has no accepted authority
- **THEN** access to the adult patient's clinical record is refused

#### Scenario: Revocation

- **WHEN** caregiver authorization is revoked
- **THEN** subsequent reads, writes and queued clinical disclosures are refused while historical attribution remains intact

#### Scenario: Legacy migration

- **WHEN** an existing patient account is backfilled into the subject model
- **THEN** its patient/case references, ownership, routes and historical consent/audit relationships remain valid

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content
