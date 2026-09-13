## Purpose

Defines who may see and change what, so that patient clinical data reaches only the patient it
belongs to and the clinicians responsible for their care. Authorization is a property of the API,
not of the interface, and every decision it makes is recorded.

## ADDED Requirements

### Requirement: Role definitions

The system SHALL support exactly four roles in Phase 1 — `patient`, `doctor`, `clinical_admin`, and
`platform_admin` — and SHALL assign every account exactly one role. Roles SHALL NOT be self-selected
at registration: self-registration always yields `patient`, and every other role is granted by a
platform admin.

#### Scenario: Registration cannot escalate role

- **WHEN** a registration request includes a `role` field asking for `doctor` or `platform_admin`
- **THEN** the field is ignored, the account is created as `patient`, and the attempt is audit-logged

#### Scenario: Role grant is recorded

- **WHEN** a platform admin grants the doctor role to an account
- **THEN** the change is applied and an audit entry naming the actor, the target account, the prior
  role, and the new role is written

### Requirement: Authorization is enforced at the API layer

Every endpoint that reads or writes patient clinical data SHALL evaluate an authorization decision
server-side before performing any data access. Hiding an action in the interface SHALL NOT be
accepted as an access control.

#### Scenario: Direct API call bypassing the UI

- **WHEN** an authenticated patient calls an endpoint that only doctors may call, with a well-formed
  request and a valid session
- **THEN** the request is refused with `403`, no data is read or written, and an audit entry
  `authz.denied` with actor, endpoint, and target is recorded

#### Scenario: Unauthenticated clinical read

- **WHEN** an unauthenticated request targets any patient clinical resource
- **THEN** the request is refused with `401` and no clinical data appears in the response body

### Requirement: Patients see only their own data

A `patient` SHALL be able to read and write only resources owned by their own account. A request for
another patient's case, response, document, assessment, or review SHALL be refused, and SHALL be
indistinguishable from a request for a resource that does not exist.

#### Scenario: Cross-patient access attempt

- **WHEN** patient A requests a case belonging to patient B by its identifier
- **THEN** the system responds `404`, reads no clinical field of that case, and records
  `authz.denied` with both the actor and the requested target identifier

### Requirement: Doctors see only assigned patients

A `doctor` SHALL be able to read a case only while they are the case's assigned doctor. Assignment
SHALL be an explicit, recorded act. Removing an assignment SHALL immediately end that doctor's
access to the case.

#### Scenario: Unassigned doctor is refused

- **WHEN** a doctor requests a case they are not assigned to
- **THEN** the request is refused, no clinical field is read, and the denial is audit-logged

#### Scenario: Assigned doctor reads a case

- **WHEN** the assigned doctor opens a submitted case whose patient holds an active
  `share_with_assigned_doctor` consent
- **THEN** the case is returned and an audit entry `case.read` naming the doctor, the case, and the
  timestamp is recorded

#### Scenario: Assignment is revoked mid-review

- **WHEN** a doctor's assignment to a case is removed while they hold a valid session
- **THEN** their next request for that case is refused without relying on session expiry

### Requirement: Clinical admins are separated from clinical data

A `clinical_admin` SHALL have full authority over clinical *content* — questions, branching rules,
reference images, taxonomy, and knowledge-base entries — and SHALL have no default read access to
any patient's answers, documents, assessments, or reviews.

#### Scenario: Clinical admin attempts to read a case

- **WHEN** a clinical admin requests a patient's case or responses
- **THEN** the request is refused with `403` and audit-logged, even though the same account may edit
  every question that produced those responses

### Requirement: Platform admins are separated from clinical content

A `platform_admin` SHALL manage accounts, roles, configuration, and security and audit logs, and
SHALL NOT have default read access to patient clinical content. Any break-glass access SHALL require
an explicit, reason-carrying elevation that is itself audit-logged and time-limited.

#### Scenario: Platform admin reads clinical data without elevation

- **WHEN** a platform admin requests a patient's responses with no active elevation
- **THEN** the request is refused with `403` and audit-logged

#### Scenario: Break-glass elevation

- **WHEN** a platform admin elevates with a stated reason and then reads a case
- **THEN** the read succeeds, the elevation expires after at most 60 minutes, and both the elevation
  (with its reason) and the read are audit-logged
