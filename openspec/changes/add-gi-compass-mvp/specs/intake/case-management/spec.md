## Purpose

Holds the lifecycle of one clinical episode — from the patient starting an interview, through
submission, AI processing and doctor review, to the doctor releasing a result — so that at any moment
there is one unambiguous answer to what state a patient's episode is in and who is responsible for the
next move.

## ADDED Requirements

### Requirement: Case lifecycle states

A case SHALL occupy exactly one of these states: `in_progress`, `submitted`, `ai_processing`,
`ai_processed`, `ai_skipped`, `in_review`, `reviewed`, `released`, `closed`. Transitions SHALL be
explicit and SHALL be rejected when not permitted from the current state.

#### Scenario: Illegal transition is refused

- **WHEN** any caller attempts to move a case directly from `in_progress` to `released`
- **THEN** the transition is refused, the case state is unchanged, and the attempt is audit-logged

#### Scenario: Submission

- **WHEN** a patient submits a case whose currently required questions are all answered
- **THEN** the case moves to `submitted`, the submission timestamp is recorded, further patient edits
  to answers are refused, and an audit entry is written

#### Scenario: Submission with unanswered required questions

- **WHEN** a patient submits a case with a required question on the active path unanswered
- **THEN** submission is refused and the interface returns the patient to the first unanswered
  required question

### Requirement: A case is owned by one patient and assigned to one doctor

Every case SHALL belong to exactly one patient and SHALL carry at most one assigned doctor at a time.
Assignment SHALL be recorded with actor and timestamp and SHALL be reassignable, with history retained.

#### Scenario: Assignment on submission

- **WHEN** a case is submitted
- **THEN** it is assigned to a reviewing doctor and the assignment is audit-logged

#### Scenario: Reassignment retains history

- **WHEN** a case is reassigned from one doctor to another
- **THEN** the new doctor gains access, the previous doctor loses it immediately, and both the prior
  and current assignments remain in the case's history

### Requirement: Consent state routes the case

On submission the system SHALL evaluate the patient's active consents and route accordingly: with
`ai_assisted_analysis` granted the case enters `ai_processing`; without it the case moves directly to
`submitted` awaiting review and is marked `ai_skipped` with the reason recorded.

#### Scenario: AI consent absent

- **WHEN** a case is submitted by a patient who has not granted `ai_assisted_analysis`
- **THEN** no clinical content is sent to any model provider, the case reaches the doctor queue
  labelled as having no AI pre-assessment, and the reason is visible to the reviewing doctor

#### Scenario: Doctor-sharing consent absent

- **WHEN** a case is submitted by a patient who has not granted `share_with_assigned_doctor`
- **THEN** submission is refused with an explanation that a doctor cannot review the case without that
  permission, and the case remains editable

### Requirement: A patient may hold several cases

A patient SHALL be able to hold at most one `in_progress` case at a time and any number of historical
cases, and SHALL be able to see the state of each.

#### Scenario: Starting a second draft

- **WHEN** a patient with an existing `in_progress` case starts a new one
- **THEN** the system offers to resume or discard the existing draft rather than silently creating a
  second draft

### Requirement: Patients see only released clinical conclusions

A patient SHALL be able to see their own answers, their uploaded documents, and the case state at all
times, and SHALL NOT be able to see any AI-generated assessment or any doctor working note until the
doctor has explicitly released a summary.

#### Scenario: Patient requests the assessment before release

- **WHEN** a patient requests the assessment for a case in `ai_processed` or `in_review`
- **THEN** the request returns the case state only, no differential content, no red-flag list, and no
  clinician summary, and the attempt is audit-logged

#### Scenario: Patient views a released summary

- **WHEN** the doctor has released a summary
- **THEN** the patient sees the doctor-authored released content together with a statement that it is
  a clinical impression from the reviewing doctor and not a substitute for in-person evaluation, and
  the read is audit-logged
