## Purpose

Produces a defensible record of who touched which patient's clinical data, when, and why — required
both for DPDP accountability and for the clinical defensibility of any assessment the platform helped
produce. The log is append-only and is never the same store the application can rewrite.

## ADDED Requirements

### Requirement: Every clinical data access is logged

The system SHALL write an audit entry for every read and every write of patient clinical data —
questionnaire responses, uploaded documents and their extracts, AI assessments, doctor reviews, and
consent records. Each entry SHALL record the actor identifier, the actor's role at the time, the
action, the target type and identifier, a UTC timestamp, and request metadata.

#### Scenario: Doctor opens a case

- **WHEN** an assigned doctor opens a case view that loads responses, documents, and the AI assessment
- **THEN** an audit entry is written for each of those resource reads, not one entry for the page

#### Scenario: Read that returns no data is still logged

- **WHEN** an authorization check refuses a clinical read
- **THEN** an `authz.denied` entry is written naming the actor and the target that was requested

### Requirement: The audit log is append-only

Audit entries SHALL NOT be updatable or deletable through any application code path. The application
database role SHALL hold insert and select privileges on the audit table and SHALL NOT hold update or
delete privileges.

#### Scenario: Attempted mutation fails

- **WHEN** any code path attempts to update or delete an audit entry
- **THEN** the operation fails at the database privilege level rather than being prevented only by
  application logic

#### Scenario: Erasure request does not erase the audit trail

- **WHEN** a patient's clinical data is erased under a data-subject erasure request
- **THEN** the clinical content is removed but the audit entries recording who accessed it remain,
  with the subject referenced by a retained pseudonymous identifier

### Requirement: Audit failure does not silently pass

If an audit entry cannot be written, the operation it describes SHALL fail rather than proceeding
unrecorded, for any write to patient clinical data.

#### Scenario: Audit store unavailable during a clinical write

- **WHEN** the audit store rejects the entry for a doctor's review finalization
- **THEN** the finalization is rolled back and the doctor is shown a retryable error, leaving no
  unlogged change to clinical data

### Requirement: Audit entries carry no clinical payload

An audit entry SHALL identify what was accessed but SHALL NOT copy the clinical content itself, so
that the audit store does not become a second uncontrolled copy of patient health data.

#### Scenario: Response value is not duplicated into the log

- **WHEN** a patient's answer to a symptom question is saved
- **THEN** the audit entry names the case, the question identifier, and the action, and does not
  contain the answer value

### Requirement: Audit log is reviewable by platform admins only

Reading the audit log SHALL be restricted to `platform_admin`, and reading it SHALL itself be
audit-logged.

#### Scenario: Doctor queries the audit log

- **WHEN** a doctor requests audit entries
- **THEN** the request is refused with `403` and the refusal is recorded
