## Purpose

Gives the reviewing doctor everything needed to judge a case on one screen — the patient's own answers,
their uploaded documents, and the AI's structured assessment — with the authority to change any of it
and the sole authority to release a conclusion to the patient.

## ADDED Requirements

### Requirement: A prioritized review queue

The dashboard SHALL present the doctor's assigned cases with their state, submission time, and highest
triggered red-flag urgency, sortable by urgency and by submission time, with emergency-flagged cases
distinguishable at a glance.

#### Scenario: Emergency case surfaces

- **WHEN** a case with an `emergency` red flag enters the queue
- **THEN** it is visually distinguished and sorts above non-flagged cases under the default ordering

#### Scenario: Queue shows only assigned cases

- **WHEN** a doctor loads the queue
- **THEN** only cases currently assigned to them appear, and each queue load is audit-logged

### Requirement: One-screen case review

The case view SHALL present, without navigating away: the patient's answers organized by symptom
cluster with the branching context that produced them, the uploaded documents with their extracts and
links to the originals, the triggered red flags with their basis, and the AI assessment.

#### Scenario: Answers show their context

- **WHEN** a doctor reads an answer that only appeared because of an earlier answer
- **THEN** the triggering answer is shown with it, so the doctor can see why the question was asked

#### Scenario: Case with no AI assessment

- **WHEN** a case reached the queue as `ai_skipped` or with the assessment unavailable
- **THEN** the view states plainly why there is no assessment and presents the answers and documents
  for direct review

#### Scenario: Every panel read is audit-logged

- **WHEN** the case view loads responses, documents, and the assessment
- **THEN** an audit entry is recorded for each resource read with the doctor as actor

### Requirement: The doctor may override anything the AI produced

The doctor SHALL be able to adjust the likelihood of any differential item, add an item, remove an
item, mark an item as rejected with a reason, and write free-text clinical notes. The original AI
assessment SHALL remain stored unmodified alongside the doctor's version.

#### Scenario: Override preserves the original

- **WHEN** a doctor lowers a differential item's likelihood and removes another item
- **THEN** the doctor's version reflects the edits and the original AI assessment remains retrievable
  exactly as generated

#### Scenario: Doctor adds a condition the AI did not raise

- **WHEN** a doctor adds a differential item of their own
- **THEN** it is recorded as doctor-authored and is distinguishable from AI-generated items

### Requirement: Every override is captured as a feedback diff

Each doctor edit to an AI-generated item SHALL be recorded as a structured before-and-after diff with
the doctor's rationale where given, so the knowledge base and prompt can be refined from real
disagreements.

#### Scenario: Diff is queryable

- **WHEN** the clinical team reviews recent overrides
- **THEN** each diff is retrievable with the case reference, the AI's original value, the doctor's
  value, the rationale, and the model, prompt, and knowledge-base versions in force

#### Scenario: Diffs do not feed automatic model training

- **WHEN** feedback diffs accumulate
- **THEN** they are available for human review and knowledge-base curation, and no automated process
  submits patient clinical content for model training

### Requirement: Only the doctor's finalized summary may state a conclusion

The doctor SHALL author a final summary and recommended next steps — investigations, referral urgency,
whether an in-person visit is needed. This is the only artefact permitted to state a clinical
impression, and it SHALL be phrased as an impression pending any in-person confirmation the doctor
deems necessary. Any prescription SHALL be authored entirely by the doctor and SHALL NOT be produced,
suggested, or pre-filled by the system.

#### Scenario: Finalization requires doctor-authored content

- **WHEN** a doctor attempts to finalize with the AI's `clinician_summary` copied through untouched and
  no doctor-authored content
- **THEN** finalization is refused with an explanation that the released summary must be the doctor's
  own

#### Scenario: No system-generated prescription

- **WHEN** a doctor opens the next-steps editor
- **THEN** no medication or dose is pre-filled or suggested by the system, and any such content is
  typed by the doctor

### Requirement: Release to the patient is explicit and confirmed

Releasing a summary to the patient SHALL require a deliberate action with an explicit confirmation
step showing exactly what the patient will see. Release SHALL NOT occur automatically on
finalization, on a timer, or as a side effect of any other action.

#### Scenario: Confirmation is required

- **WHEN** a doctor clicks release
- **THEN** a confirmation showing the patient-visible content is presented, and nothing is sent or made
  visible until the doctor confirms

#### Scenario: Nothing auto-releases

- **WHEN** a case is finalized and left untouched
- **THEN** the patient continues to see only the case state, and no assessment content becomes visible
  to them through the passage of time

#### Scenario: Release is recorded

- **WHEN** a doctor confirms release
- **THEN** the release timestamp, the releasing doctor, and the exact released content version are
  stored, the patient is notified, and the release is audit-logged

### Requirement: Doctors can message the patient about a case

The doctor SHALL be able to send a message to the patient in the case's context; messages SHALL be
stored with the case and SHALL be audit-logged. Messaging SHALL NOT be a route around the release
gate for unreviewed AI content.

#### Scenario: Message composer excludes raw AI content

- **WHEN** a doctor composes a message
- **THEN** the composer offers no action that inserts the raw AI assessment, and the doctor writes the
  message themselves
