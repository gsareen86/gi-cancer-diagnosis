## Purpose

Allow accountable clinical ownership of a versioned instrument without routine code editing.

## ADDED Requirements

### Requirement: Clinical publication requires evidence and approval

Authorized clinical editors SHALL draft, preview and publish supported questions, rules, wording and image associations through an API/UI. Publication SHALL require rationale, scenario results and recorded clinical approval. Changes SHALL be audited.

#### Scenario: Publish reviewed version

- **WHEN** an authorized clinician approves a draft with passing required scenarios and references
- **THEN** publication creates an immutable version with the actor, rationale and evidence recorded

#### Scenario: Unsafe or unapproved version

- **WHEN** a draft has failed safety journeys, missing approval or invalid references
- **THEN** publication is refused and the current approved version remains unchanged

#### Scenario: In-progress cases

- **WHEN** a new approved version is published
- **THEN** started cases retain their pinned version unless a separately governed migration is explicitly performed

#### Scenario: Unauthorized edit

- **WHEN** a patient or non-editor attempts to modify clinical configuration
- **THEN** the change is refused and the attempt is recorded

### Requirement: Language and source availability are explicit

Each language and source asset SHALL record approval/permission status, version and review date. Unapproved languages, unlicensed ingestion and unavailable images SHALL NOT be presented as functioning approved features.

#### Scenario: Hindi approval absent

- **WHEN** Hindi wording exists but lacks the required clinical approval
- **THEN** it remains unpublished and the app does not advertise it as available

#### Scenario: Image missing

- **WHEN** a referenced illustration cannot be served
- **THEN** a useful text alternative remains and no dead image instruction silently disappears

#### Scenario: Guidance source ingestion

- **WHEN** an editor proposes a guideline source
- **THEN** its permitted use, version, attribution and review are recorded before ingestion, and public visibility alone is not treated as permission

#### Scenario: Preview contains patient data

- **WHEN** an editor requests a preview using a real patient case rather than a fictional fixture
- **THEN** the normal patient-specific consent, assignment/access and audit requirements apply
