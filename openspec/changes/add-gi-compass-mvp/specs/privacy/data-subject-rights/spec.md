## Purpose

Gives patients a working route to exercise their DPDP rights of access, correction, and erasure, and
gives the platform an enforced retention policy so clinical data does not accumulate indefinitely
beyond the purpose it was collected for.

## ADDED Requirements

### Requirement: Patients can request a copy of their data

The system SHALL allow an authenticated patient to request an export of the personal and clinical data
held about them and SHALL deliver it in a machine-readable format within a defined service level.

#### Scenario: Export request is fulfilled

- **WHEN** a patient requests an export
- **THEN** a request record is created with its due date, the export is produced containing their
  profile, consent history, responses, document metadata and originals, released assessments, and the
  fulfilment is audit-logged

#### Scenario: Export excludes other people's data

- **WHEN** an export is produced for a patient whose case carries a doctor's private working notes
- **THEN** the export includes the doctor-released summary and excludes any content not released to
  the patient, and this exclusion is stated in the export

### Requirement: Patients can request correction

The system SHALL allow a patient to request correction of inaccurate personal data. Clinical answers
already submitted SHALL NOT be silently rewritten; a correction SHALL be recorded as an amendment
that preserves the original, because the assessment was produced from the original.

#### Scenario: Profile correction

- **WHEN** a patient corrects their recorded date of birth
- **THEN** the profile is updated, the prior value is retained in the amendment history, and the
  change is audit-logged

#### Scenario: Correction to a submitted answer

- **WHEN** a patient asks to change an answer on a case that has already been submitted
- **THEN** the system records an amendment linked to the original response, flags the case for the
  reviewing doctor's attention, and leaves the original response readable

### Requirement: Patients can request erasure

The system SHALL accept an erasure request, SHALL confirm the consequences before acting, and SHALL
remove or irreversibly anonymize the patient's clinical content while retaining what law or clinical
defensibility requires.

#### Scenario: Erasure is confirmed before it runs

- **WHEN** a patient submits an erasure request
- **THEN** the system requires an explicit second confirmation that names what will be deleted and
  what will be retained, and does not delete anything until that confirmation is given

#### Scenario: Erasure with an open clinical obligation

- **WHEN** erasure is requested for a case currently under doctor review
- **THEN** the request is recorded, the patient is told the review will be closed first, and erasure
  proceeds once the clinical obligation is discharged rather than being silently ignored

### Requirement: Retention is defined per data category and enforced

The system SHALL hold a retention policy naming, for each data category, how long it is kept and what
happens at expiry, and SHALL run a scheduled job that applies it. Retention periods SHALL be
configuration, not code constants, so they can be set with legal counsel without a deploy.

#### Scenario: Expired draft case

- **WHEN** a case has remained `in_progress` with no patient activity beyond the configured
  abandoned-draft period
- **THEN** the retention job deletes the draft's clinical content, retains the audit entries, and
  records the deletion

#### Scenario: Retention period is not yet set

- **WHEN** the retention configuration for a category has no value set
- **THEN** the job takes no destructive action for that category and raises an operational alert,
  rather than defaulting to deletion
