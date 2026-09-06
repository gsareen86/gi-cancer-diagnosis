## Purpose

Track the next action and its owner without equating communication with completed care.

## ADDED Requirements

### Requirement: Care actions distinguish reported progress from verified completion

Each follow-through action SHALL record its recommendation, owner, review/due time where appropriate, progress source and closure reason. Reading advice SHALL record receipt only.

#### Scenario: Summary acknowledged

- **WHEN** a patient acknowledges the released summary
- **THEN** receipt is recorded without closing outstanding care actions

#### Scenario: Patient reports attendance

- **WHEN** a patient states that an appointment occurred
- **THEN** progress is attributed as patient-reported and does not imply verified diagnosis or result review

#### Scenario: Uploaded result

- **WHEN** a requested document is uploaded
- **THEN** receipt and clinical review remain separate states with the responsible reviewer visible

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Follow-through supports barriers and changed symptoms

Patients SHALL be able to report access barriers, decline actions, request clarification and submit changed symptoms. Reminders SHALL be bounded, consented and tied to an actual responsible service.

#### Scenario: Unable to attend

- **WHEN** a patient reports travel or cost difficulty
- **THEN** the barrier is recorded and any offered assistance reflects a genuinely configured service

#### Scenario: Symptoms change

- **WHEN** a patient reports a new concerning symptom after release
- **THEN** a new safety assessment runs without waiting for a routine message and the old advice remains historically intact

#### Scenario: Reminder opt-out

- **WHEN** the patient withdraws notification permission
- **THEN** future reminders are suppressed under the applicable preferences while authorized care records are retained appropriately

#### Scenario: Commercial source differs

- **WHEN** two otherwise equivalent cases arrive from different hospital/referral links
- **THEN** funding and acquisition source do not alter clinical urgency or appropriate referral destination

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content
