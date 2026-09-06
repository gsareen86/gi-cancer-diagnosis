## Purpose

Provide a short factual brief and recoverable, explicit clinician decisions in the existing workspace.

## ADDED Requirements

### Requirement: The brief and queue do not depend on AI

The clinician SHALL receive a source-linked summary of the current version with explicit unknowns even when no reports or model output exist. Opening a case SHALL be read-only with respect to review workflow. Counts SHALL include in-review and awaiting-information work.

#### Scenario: No model and no reports

- **WHEN** the clinician opens a symptom-only case while inference is unavailable
- **THEN** the deterministic history brief and manual actions remain available

#### Scenario: Skimming the queue

- **WHEN** a clinician opens five cases without choosing Start Review
- **THEN** no review-start transition or patient notification occurs

#### Scenario: Narrow viewport

- **WHEN** the queue is opened on a narrow phone screen
- **THEN** case actions and key details are accessible without traversing a wide clipped table

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Drafts and clarification are recoverable

Review drafts SHALL autosave server-side with visible persistence status and revision conflict protection. Information requests SHALL support authorized replies and amendments. Templates SHALL be deliberate, editable and unapproved until reviewed.

#### Scenario: Session or navigation interruption

- **WHEN** a clinician resumes after session renewal or navigation following a confirmed save
- **THEN** the saved draft is restored without exposing it to another user

#### Scenario: Concurrent tabs

- **WHEN** two tabs attempt to save changes based on the same revision
- **THEN** the stale write is rejected with a recoverable conflict rather than silently overwriting newer work

#### Scenario: Patient clarification

- **WHEN** the patient replies to an open authorized information request
- **THEN** the clinician sees the response and changed source version without rewriting the earlier signed record

#### Scenario: Template use

- **WHEN** a clinician previews and applies a template
- **THEN** the change is visible, editable and undoable and does not itself finalize a diagnosis, urgency or release

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Released letters identify the reviewed version and clinician

Finalization and release SHALL be separate explicit actions. The released snapshot SHALL include patient identity, clinician name/registration, appropriate verified service identity, timestamps, source version and approved text. Private notes and raw AI SHALL be excluded.

#### Scenario: Stale or unauthorized finalization

- **WHEN** authorization, assignment, source version or draft revision is no longer valid at release
- **THEN** the transaction refuses release and queues no patient disclosure

#### Scenario: Profile changes later

- **WHEN** the clinician profile is edited after a letter was released
- **THEN** the original letter retains the identity snapshot approved at release

#### Scenario: No prescription expansion

- **WHEN** the new letter capability is implemented
- **THEN** historical physician-authored signed content remains available and no autonomous prescribing or new e-prescribing workflow is introduced

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content
