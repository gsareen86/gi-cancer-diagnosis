## Purpose

Preserve the symptom story and complete clinical history without converting omissions into negative findings.

## ADDED Requirements

### Requirement: History and trajectory have explicit provenance

The record SHALL support onset, duration uncertainty, progression, functional effect, remedies and response, previous consultations, relevant medical/surgical/family history, medicines, allergies and measurement sources. Each compiled fact SHALL identify its source and assertion state.

#### Scenario: No report history

- **WHEN** a patient reports recurring discomfort and repeated OTC use without reports
- **THEN** the brief includes the timeline and reported treatment response, with product/dose uncertainty visible, without inventing a diagnosis or normal examination

#### Scenario: Omitted fields

- **WHEN** an allergy, smoking, alcohol or condition field is skipped
- **THEN** it remains unknown/not recorded and SHALL NOT be defaulted to none or never

#### Scenario: Implausible measurement

- **WHEN** a supplied height or weight fails approved plausibility checks
- **THEN** the patient is asked to check the value and no misleading derived clinical interpretation is produced from an unconfirmed invalid input

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Post-submission information is a versioned amendment

Submitted and released records SHALL remain immutable. Authorized corrections, clarifications and additional documents SHALL create a new source version. Unreleased approvals dependent on changed information SHALL become stale.

#### Scenario: Requested report arrives

- **WHEN** a patient uploads an existing report in response to a clinician request
- **THEN** a dated amendment is created, the responsible reviewer is informed through the authorized outbox and historical submissions/releases remain unchanged

#### Scenario: Conflicting history

- **WHEN** caregiver and patient accounts disagree
- **THEN** both sources remain attributable and the discrepancy is visible until an authorized reconciliation is recorded

#### Scenario: Stale release

- **WHEN** a clinician attempts release against a source snapshot superseded by an amendment
- **THEN** release is refused until the current information is reviewed and approved

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content
