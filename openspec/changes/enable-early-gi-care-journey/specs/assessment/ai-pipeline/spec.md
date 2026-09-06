## Purpose

Make AI optional, source-bound and separate from authoritative facts and patient advice.

## ADDED Requirements

### Requirement: Assessment inputs contain the complete current record

The summary compiler and Python contract SHALL include relevant structured history and provenance in an immutable input snapshot. Model results SHALL be linked to that snapshot and SHALL NOT overwrite newer data.

#### Scenario: Relevant medicine history

- **WHEN** regular patient-reported medicine use exists in clinical history
- **THEN** it reaches the factual brief and permitted AI factual input with its source

#### Scenario: Late model result

- **WHEN** a job finishes after the patient has amended the history
- **THEN** the result is marked stale for the older snapshot and is not silently adopted into current review

#### Scenario: Unavailable generation

- **WHEN** inference times out or fails validation after bounded retries
- **THEN** manual review remains available with a clear failure status

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: AI output preserves factual and treatment boundaries

AI output SHALL remain private until explicit clinician adoption and release. Validation SHALL distinguish source-bound medication mentions from new treatment instructions, permit insufficient-information outcomes and reject unsupported scope.

#### Scenario: Legitimate history

- **WHEN** a source-bound summary states a medication the patient already reported
- **THEN** it is permitted as history without representing a prescription

#### Scenario: Unsupported treatment or staging

- **WHEN** generated text attempts autonomous prescribing or assigns unsupported cancer stage/resectability
- **THEN** the output is refused for adoption/release under the constrained contract

#### Scenario: Insufficient evidence

- **WHEN** the record does not support a differential
- **THEN** the schema permits abstention rather than forcing populated diagnoses

#### Scenario: No approved guidance

- **WHEN** appropriate licensed and clinician-approved grounding is unavailable
- **THEN** recommendation-generation features remain disabled while the factual brief and clinician manual work remain available

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Extraction is a candidate source, not a patient answer

Extracted facts SHALL retain original-document/page, date, units and verification status. Unverified extraction SHALL NOT silently populate deterministic patient safety answers.

#### Scenario: Uncertain result

- **WHEN** a blurred document or ambiguous date/unit is extracted
- **THEN** uncertainty is visible and the original source remains accessible for authorized review

#### Scenario: Quarantined or wrong-patient document

- **WHEN** inspection fails or identity mismatch is identified
- **THEN** the document is not used as current verified evidence or fed through ordinary downstream processing

#### Scenario: Patient confirmation

- **WHEN** a patient confirms an extracted symptom statement
- **THEN** a separate patient-attested answer is recorded and evaluated by the approved safety engine

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content
