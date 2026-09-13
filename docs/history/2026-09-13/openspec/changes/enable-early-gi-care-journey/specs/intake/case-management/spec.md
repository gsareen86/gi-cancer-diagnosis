## Purpose

Support useful preparation with no reports and honest receipt into an available service.

## ADDED Requirements

### Requirement: The primary intake is symptom-first and report-optional

The patient journey SHALL support approved language, focused symptom stages, existing visual aids with textual alternatives and editing before submission. Reports SHALL be optional, and missing investigations SHALL NOT block consultation access.

#### Scenario: No reports

- **WHEN** an authenticated user has no documents
- **THEN** the approved intake can be completed and a factual history prepared

#### Scenario: Image or extraction failure

- **WHEN** a reference image or extraction service fails
- **THEN** the relevant question remains understandable/selectable and the patient can proceed with text and optional original-document upload

#### Scenario: Unsupported language or clinical scope

- **WHEN** the requested language or patient group lacks approved content
- **THEN** the application states that limitation honestly and offers appropriate general access guidance without silently applying an unapproved instrument

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Service acceptance is explicit

Submission SHALL distinguish saved preparation, requested review and accepted review. It SHALL show actual service availability and ownership status and SHALL NOT invent a review commitment when capacity is absent.

#### Scenario: No available service

- **WHEN** no configured service can accept a requested review
- **THEN** the system explains the actual status and offers a patient-prepared history or general next-access guidance without claiming a doctor has the case

#### Scenario: Accepted submission

- **WHEN** the configured service accepts the case
- **THEN** receipt records ownership/service context and the applicable configured review window while preserving any immediate-care advice

#### Scenario: Retry after timeout

- **WHEN** a patient retries a submission whose response was lost
- **THEN** the idempotent transition returns the same result without duplicate cases or notifications

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content
