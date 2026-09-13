## Purpose

Define reproducible agreement and human-time measures before building persistent
pilot telemetry, so later dashboards cannot turn approval clicks or missing data into success.

## ADDED Requirements

### Requirement: Evaluations identify comparable versions and exposure

The evaluation contract SHALL identify protocol, synthetic/pilot cohort, site code,
input snapshot, content, model/prompt and reference versions. It SHALL distinguish
independent clinician assessment before AI reveal from an AI-exposed assessment.
This increment SHALL implement only pure contracts/calculation and synthetic fixtures;
it SHALL not store patient-linked evaluations or expose a public submission API.

#### Scenario: Reviewer saw the AI first
- **GIVEN** an assessment was recorded after AI reveal
- **WHEN** agreement is calculated
- **THEN** it is excluded from independent agreement pairs with the exposure reason counted
- **AND** it is not silently dropped from the eligible-encounter total

#### Scenario: Snapshots differ
- **WHEN** AI and independent reference concern different source snapshots or incompatible value-set versions
- **THEN** they are classified as not comparable, not as agreement or disagreement

### Requirement: Primary and secondary agreement remain distinct

Primary specialty agreement SHALL compare one primary AI specialty against one
independent clinician primary specialty. Acceptable-set agreement SHALL be a separately
named secondary measure. Urgency SHALL be compared using structured action/constraint
data with outcomes agree, AI less urgent, AI more urgent or not comparable. Differential
usefulness SHALL not be presented as a diagnosis-accuracy percentage.

#### Scenario: AI route is acceptable but not the primary choice
- **WHEN** the AI primary differs from the clinician primary but belongs to the predeclared acceptable set
- **THEN** primary agreement is false and secondary acceptable-route agreement is true

#### Scenario: Uncomparable urgency wording
- **WHEN** either output contains only unstructured timeframe wording without comparable constraints
- **THEN** urgency agreement is not computed from text similarity
- **AND** the case is counted as not comparable

### Requirement: Missing outcomes never count as success

Aggregates SHALL return eligible and evaluable counts, agreement numerators, and
reason counts for missing reference, AI failure, AI abstention, inadequate information,
withdrawal, version mismatch and AI exposure. Zero evaluable pairs SHALL yield an
unavailable rate, not zero or one hundred percent. No default success threshold SHALL
be invented by the calculator.

#### Scenario: All model jobs failed
- **WHEN** every eligible example lacks an AI result
- **THEN** evaluable agreement is zero and the agreement rate is unavailable
- **AND** failures remain visible in the eligible total

#### Scenario: Mixed incomplete data
- **WHEN** a fixture has evaluable, withdrawn, abstained and missing-reference encounters
- **THEN** every eligible encounter has one exclusive primary accounting disposition
- **AND** the disposition counts reconcile to the eligible total

### Requirement: Time saved measures active human effort

The timing contract SHALL distinguish actor, activity, explicit start/pause/resume/end,
cohort and correction provenance. The calculator SHALL sum active, non-overlapping
intervals per actor; reject invalid order, negative duration, duplicate event identity
and unresolved same-actor overlap; and report missing/incomplete observation as not
measurable. Staff effort and AI waiting SHALL be separate from clinician OPD effort.

#### Scenario: Clinician leaves the tab open
- **WHEN** the activity is paused during an interruption
- **THEN** the pause interval adds no active clinician time regardless of tab lifetime

#### Scenario: Concurrent staff work
- **WHEN** a coordinator and clinician work simultaneously
- **THEN** both actors' effort is retained separately
- **AND** it is not misreported as additional clinician time or ignored staff cost

#### Scenario: Missing baseline or unfinished observation
- **WHEN** there is no comparable usual-care baseline or a required interval is incomplete
- **THEN** savings are unavailable with an explicit reason rather than invented from AI generation speed

### Requirement: Measurement contracts do not create a PHI collection channel

The pure contract SHALL reject direct identifiers, clinical narrative, report content
and unknown extra fields. Its tests SHALL use invented codes and timestamps. Future
storage/export SHALL require a separate access/consent/audit specification before
patient-linked data can be accepted.

#### Scenario: Patient narrative sent as a metric
- **WHEN** a payload includes a patient name, free-text history or report body
- **THEN** validation rejects it without persisting or logging its content
- **AND** no endpoint is created to bypass patient/site authorisation or consent
