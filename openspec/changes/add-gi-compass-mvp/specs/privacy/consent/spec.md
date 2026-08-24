## Purpose

Makes consent a first-class, versioned, per-purpose data object rather than a checkbox, so that every
act of processing health data can be traced to a specific affirmative permission the patient gave and
can still withdraw. This is the DPDP Act 2023 obligation the rest of the system is gated on.

## ADDED Requirements

### Requirement: Consent is granular and per-purpose

The system SHALL define a closed set of processing purposes and SHALL record consent independently
for each. Phase 1 purposes are `account_processing`, `ai_assisted_analysis`, and
`share_with_assigned_doctor`. A single combined acceptance covering several purposes SHALL NOT be
offered.

#### Scenario: Purposes are presented separately

- **WHEN** a patient reaches the consent step
- **THEN** each purpose is presented as its own affirmative control with its own plain-language
  explanation of what is processed and why, and none is pre-selected

#### Scenario: Partial consent is a valid state

- **WHEN** a patient grants `account_processing` and `share_with_assigned_doctor` but declines
  `ai_assisted_analysis`
- **THEN** the account remains usable, the case may still be created and submitted for direct doctor
  review, and no AI processing is performed on it

### Requirement: Consent records are immutable and versioned

Each grant SHALL be stored as a new immutable record capturing the purpose, the exact policy document
version presented, the granting timestamp, and the request metadata (IP address and user agent). A
consent record SHALL NEVER be updated in place; withdrawal SHALL be recorded by stamping a withdrawal
timestamp, and re-granting SHALL create a new record.

#### Scenario: Grant creates a record

- **WHEN** a patient grants a purpose
- **THEN** a consent record is written with purpose, policy version, timestamp, and request metadata,
  and an audit entry `consent.granted` is recorded

#### Scenario: History is preserved across a withdraw-and-regrant cycle

- **WHEN** a patient withdraws a purpose and later grants it again
- **THEN** three facts remain independently readable: the original grant, its withdrawal timestamp,
  and the new grant — with the earlier records unmodified

### Requirement: Withdrawal is as easy as granting

The system SHALL present withdrawal for each purpose in the patient's own account area, reachable in
no more actions than granting took, and SHALL take effect immediately on the next processing decision
without requiring the patient to contact support.

#### Scenario: Withdrawal takes effect immediately

- **WHEN** a patient withdraws `ai_assisted_analysis` while a case of theirs is queued for AI
  processing
- **THEN** the queued AI processing does not run, the case proceeds to direct doctor review, and an
  audit entry `consent.withdrawn` is recorded

#### Scenario: Withdrawal of doctor sharing closes doctor access

- **WHEN** a patient withdraws `share_with_assigned_doctor`
- **THEN** the assigned doctor's next request for that patient's case is refused, and the doctor is
  shown that access was withdrawn rather than that the case does not exist

### Requirement: Processing is gated on an active consent

Any operation that processes patient clinical data for a purpose SHALL verify an active,
non-withdrawn consent record for that exact purpose immediately before processing. The check SHALL
happen in the data-access layer so that no caller can reach the data by skipping it.

#### Scenario: Missing consent blocks AI processing

- **WHEN** a case is submitted by a patient with no active `ai_assisted_analysis` consent
- **THEN** the AI pipeline is not invoked, no clinical content is sent to any model provider, and the
  case is routed to the doctor queue marked "AI analysis not consented"

#### Scenario: Expired policy version requires re-consent

- **WHEN** the policy version attached to a purpose has been superseded and the patient has not
  accepted the new version
- **THEN** processing for that purpose is refused until the patient grants consent against the current
  policy version

### Requirement: Consent state is legible to the patient

The system SHALL show the patient, at any time, which purposes they have granted, when, against which
policy version, and what withdrawing each one would stop.

#### Scenario: Patient reviews consent

- **WHEN** a patient opens their privacy settings
- **THEN** every purpose is listed with its current state, grant timestamp, policy version, and a
  plain-language consequence-of-withdrawal statement, and the read is audit-logged
