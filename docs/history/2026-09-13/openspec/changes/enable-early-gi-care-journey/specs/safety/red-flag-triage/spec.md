## Purpose

Ensure actual patient journeys receive appropriate approved advice independently of AI and symptom entry.

## ADDED Requirements

### Requirement: Safety obligations are evaluated on actual answers

The system SHALL acquire clinically approved safety facts and required follow-ups independently of the symptom entry point. Unknown answers SHALL remain unknown. Completion SHALL reflect unresolved safety obligations rather than hypothetical graph reachability.

#### Scenario: Nonbloody vomiting path

- **WHEN** a synthetic patient reports inability to keep fluids down after nonbloody vomiting
- **THEN** the approved follow-ups needed to assess dehydration are asked without requiring unrelated bleeding or bowel positives

#### Scenario: Uncertainty is not reassurance

- **WHEN** a required safety fact is unknown or cannot be assessed
- **THEN** the system states the assessment is incomplete and provides approved guidance without recording a negative answer or asserting that serious disease is excluded

#### Scenario: Answer changes

- **WHEN** an answer changes after earlier branches were completed
- **THEN** the engine recomputes relevant questions and evaluations while preserving the prior version and not silently deleting an unresolved safety event

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Urgent advice is persistent and advice-only

Immediate-care advice SHALL be synchronous, clinically approved and available without AI or successful OTP delivery. The application SHALL NOT offer emergency calling, SOS dispatch or emergency-contact notifications. Acknowledgement and submission SHALL NOT imply that waiting for review is safe.

#### Scenario: Model or persistence failure

- **WHEN** a concerning answer matches an approved rule while AI is down or answer persistence fails
- **THEN** the approved local evaluator displays advice immediately, marks any unsaved answer state honestly and does not wait for a job

#### Scenario: Continue or submit

- **WHEN** a patient acknowledges advice or submits the case
- **THEN** the continuing view retains the urgent advice and no-wait instruction without repeatedly showing the identical interruption on every answer

#### Scenario: Pre-account safety

- **WHEN** a user completes preliminary safety questions before authentication
- **THEN** answers remain in volatile memory without clinical analytics or server storage and are confirmed and evaluated server-side only after appropriate authorization and consent

#### Scenario: No emergency dispatch

- **WHEN** an emergency-level rule triggers
- **THEN** no phone action, emergency-contact prompt or automatic SOS job is exposed or created

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content
