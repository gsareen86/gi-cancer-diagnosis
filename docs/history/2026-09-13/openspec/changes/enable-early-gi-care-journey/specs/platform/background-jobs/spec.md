## Purpose

Execute accepted background work reliably without depending on open browser tabs.

## ADDED Requirements

### Requirement: Jobs are durable and source-version aware

Business changes and outbox events SHALL commit atomically. Workers SHALL use leases, idempotency, bounded retries and visible terminal failures. Clinical access SHALL use a scoped worker authority and the applicable live purpose.

#### Scenario: Worker crash

- **WHEN** a worker crashes after claiming work
- **THEN** the lease expires and the job can resume without duplicating the logical clinical action

#### Scenario: Consent changes

- **WHEN** ordinary clinical processing consent or disclosure authority is withdrawn before execution
- **THEN** the worker refuses that processing/disclosure and records the outcome without requiring a browser visit

#### Scenario: Outdated input

- **WHEN** a job refers to a superseded clinical snapshot
- **THEN** it cannot replace current information or dispatch stale advice

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Operational ownership is distinct from clinical urgency

Assignment and overdue checks SHALL use configured eligibility, availability, capacity and service ownership. Operational waiting windows SHALL NOT delay or weaken immediate-care advice.

#### Scenario: All browsers closed

- **WHEN** an accepted case breaches its configured service review time
- **THEN** the scheduler records the breach and alerts an actual configured operator through authorized channels

#### Scenario: No available clinician

- **WHEN** no eligible clinician is available
- **THEN** the case is not silently assigned to the first account and the real acceptance/ownership status is visible

#### Scenario: No fallback staff

- **WHEN** no backup operator or fellow is configured
- **THEN** the system reports the missing coverage rather than inventing a recipient or promising monitoring

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content

### Requirement: Notification delivery is observable and bounded

Delivery SHALL distinguish queued, attempted, provider-accepted, confirmed where supported, failed and ambiguous outcomes. External notifications SHALL minimize clinical content and use authenticated links.

#### Scenario: Duplicate or ambiguous provider receipt

- **WHEN** a receipt is repeated or the provider response is uncertain
- **THEN** logical delivery records are deduplicated or marked uncertain without claiming exactly-once delivery

#### Scenario: Delivery failure

- **WHEN** retries are exhausted
- **THEN** the actual service owner sees an actionable failure and the patient is not recorded as informed merely because a job existed

#### Scenario: Unconfigured provider

- **WHEN** the provider or recipient preference is not configured
- **THEN** no live disclosure is sent and the status explicitly distinguishes a development/logged-only result

#### Scenario: Clinical access is checked and recorded

- **WHEN** an actor or worker reads or changes clinical data under this requirement
- **THEN** the service checks the actor-to-patient scope and applicable current purpose/authority, audits authorized access with actor, patient and version identifiers, and refuses unauthorized access without returning clinical content; rejected access is recorded without leaking that content
