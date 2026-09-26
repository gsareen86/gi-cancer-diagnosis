## Purpose

Provides purpose-bound audit evidence for protected operations, with durable expected
denials, restricted site-admin review and explicit security-boundary coverage.

## ADDED Requirements

### Requirement: Protected access and audit succeed together
The system SHALL return or change protected records only if the corresponding audit event
commits in the same transaction. Expected authorisation denials SHALL commit an audit event
without returning PHI. Audit-storage failure SHALL fail the operation with no PHI returned
or changed. Allowed events SHALL record the server-derived actor, effective role, authorised
site, validated purpose, action, returned record identifiers, outcome, timestamp and request ID.

#### Scenario: Allowed patient list
- **GIVEN** an authorised clinician at Demo Clinic
- **WHEN** they list patients for direct care
- **THEN** the list and its allowed audit event commit together with exactly the returned identifiers

#### Scenario: Denial survives the request
- **WHEN** a request is denied for role or site
- **THEN** it returns no protected data
- **AND** a separate subsequent authorised audit read finds its committed denial entry

#### Scenario: Audit insert fails
- **WHEN** audit storage fails during an otherwise permitted patient read
- **THEN** the operation returns no patient data and no clinical change commits

### Requirement: Denial metadata does not reveal foreign records
The system SHALL use the same unavailable response and denied_or_not_found outcome for
absent and unauthorised records. It SHALL NOT probe foreign record existence. Denials SHALL
contain no record identifiers; an unauthorised requested site SHALL NOT be exposed through
the requesting site's audit log. Sites outside the actor's memberships SHALL be represented
without a site identifier in restricted operator security events.

#### Scenario: Clinician is also site admin
- **GIVEN** a clinician who administers only Demo Clinic
- **WHEN** they request a foreign patient's identifier and then inspect their own site's audit log
- **THEN** neither response nor log reveals whether that foreign record or site exists

### Requirement: Purpose and event provenance are controlled
The system SHALL reject missing or role-inappropriate purposes without PHI and commit the
denial. Clinicians SHALL use direct_care, coordinators intake_support, and site admins
site_administration or audit_review for the corresponding operations. It SHALL derive
identity and effective role from verified context; clients SHALL NOT forge audit events,
choose another actor, or invoke a general-purpose audit writer.

#### Scenario: Forged event or purpose
- **WHEN** a client supplies another actor, an invalid purpose or tries to append a fabricated allowed event
- **THEN** no forged event or protected result is accepted
- **AND** an entered protected operation records a data-free denial

### Requirement: Audit entries are append-only and contain no clinical text
Application roles, including site admins and service-role API access, SHALL NOT update,
delete or truncate audit history. Parent cleanup SHALL NOT cascade-delete events. Events
SHALL contain identifiers and controlled codes rather than clinical content, credentials or
free-text provider errors. Trusted database-superuser limitations SHALL be documented.

#### Scenario: Mutation and truncation
- **WHEN** each application/service role attempts UPDATE, DELETE or TRUNCATE on audit history
- **THEN** every attempt is refused and existing events remain unchanged

### Requirement: Site admins can review their site's audit log
The system SHALL provide a functional audited read path for active site admins, restricted
to their sites, with bounded pagination/date filters. The read itself SHALL be audited.
No general table access or database-owner privilege SHALL be needed by the caller.

#### Scenario: Authorised admin read
- **GIVEN** an active site admin with MFA and a valid application session
- **WHEN** they request their site's audit log for audit_review
- **THEN** their site's permitted entries are returned and the review is itself recorded

#### Scenario: Cross-site audit read
- **WHEN** a site admin requests a site outside their memberships
- **THEN** no audit rows are returned and a generic denial is recorded without foreign metadata

### Requirement: Security-boundary failures have explicit coverage
Failures rejected before a protected operation begins SHALL return no PHI and use the
application or hosted Auth/API security-log path. Documentation and tests SHALL distinguish
these events from transactional record audits, identify available request correlation and
retention, and disclose coverage gaps. Unverified token claims SHALL NOT be logged as a
verified actor. Clinical request bodies SHALL NOT enter security logs.

#### Scenario: Invalid token never enters an operation
- **WHEN** the hosted API rejects a forged token before operation execution
- **THEN** no protected data is returned
- **AND** verification checks the configured security-event path without expecting a patient audit transaction

### Requirement: Privileged operator actions are attributable
Provisioning, membership changes, disablement and MFA recovery SHALL require a named
operator, coded reason and target. Intent and outcome SHALL be recorded; external Auth
failures SHALL leave a durable pending/failed event and blocked access where applicable.

#### Scenario: Recovery interrupted
- **WHEN** an operator process stops after recording recovery intent and revoking application sessions
- **THEN** the intent remains visible for reconciliation and old sessions remain refused
