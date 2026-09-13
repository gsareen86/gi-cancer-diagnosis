## Purpose

Turns a completed case into a structured, grounded, decision-support summary for the reviewing doctor:
it compiles the answers and document extracts into a clinical narrative and fact table, retrieves the
doctor's own knowledge-base guidance, calls a model under a strict contract, and refuses to persist
anything that does not conform to a fixed schema. Under India's Telemedicine Practice Guidelines the
output is support for a Registered Medical Practitioner, never a diagnosis.

## ADDED Requirements

### Requirement: Clinical summary compilation precedes any model call

The system SHALL compile the case's active answers, their branching context, the triggered red flags,
and the document extracts into a structured clinical summary containing both a narrative and a fact
table of symptoms present, symptoms explicitly denied, durations, severities, and relevant history.
This compilation SHALL be deterministic and SHALL NOT involve a model.

#### Scenario: Explicit denials are preserved

- **WHEN** a patient answers "no" to weight loss
- **THEN** the fact table records weight loss as explicitly absent, distinct from a question that was
  never asked, so the model is not left to infer absence from silence

#### Scenario: Compilation is reproducible

- **WHEN** the same case is compiled twice
- **THEN** the same structured summary is produced

### Requirement: Retrieval grounds the call in doctor-authored knowledge

Before the model call the system SHALL retrieve the most relevant knowledge-base entries for the
case's symptom clusters and candidate disease tags, and SHALL include them in the prompt as the
grounding context. The prompt SHALL instruct the model to reason from that context.

#### Scenario: Retrieved context is recorded

- **WHEN** an assessment is generated
- **THEN** the identifiers and versions of every retrieved knowledge-base entry are stored with the
  assessment, so the grounding can be reconstructed

#### Scenario: No relevant knowledge is found

- **WHEN** retrieval returns no entry above the relevance threshold
- **THEN** the assessment is still produced but is marked as ungrounded, and the doctor's view states
  that no curated guidance matched this presentation

### Requirement: The model call is constrained by a strict system prompt

The system prompt SHALL require the model to: never phrase output as a diagnosis; never name a
medication, dose, or treatment plan; attach a likelihood of `high`, `moderate`, or `low` to every
differential item; list red flags separately from differentials; and emit only the fields of the
defined schema. The call SHALL obtain its answer through a forced structured-output mechanism —
the model's only permitted reply is one conforming structured object — and SHALL NOT permit more
than one such object per case.

#### Scenario: Treatment content is rejected

- **WHEN** a model response names a drug or a dose anywhere in its output
- **THEN** the response is rejected as a schema and policy violation and is not persisted

#### Scenario: Diagnostic phrasing is rejected

- **WHEN** a model response asserts a condition as confirmed rather than as a differential possibility
  with a likelihood
- **THEN** the response is rejected and retried under a stricter reminder

### Requirement: Output schema is fixed and enforced server-side

Every model response SHALL be validated server-side against the fixed assessment schema before it
touches the database. The schema SHALL contain `case_id`, `model_version`, `prompt_version`,
`kb_version`, `generated_at`, `differential_assessment`, `red_flags`, `recommended_next_steps`,
`clinician_summary`, and `disclaimer`. The schema SHALL NOT define a final-diagnosis field, and no
code path SHALL add one.

#### Scenario: Schema violation is a failure, not something to patch

- **WHEN** a model response omits a required field or adds an undefined field
- **THEN** the response is discarded, the attempt is logged with the violation, and the call is retried
  with a stricter reminder — the response is NOT coerced, trimmed, or partially saved

#### Scenario: Retry budget is bounded

- **WHEN** the configured number of retries is exhausted without a conforming response
- **THEN** the case is moved to the doctor queue marked "AI assessment unavailable", the failure is
  recorded, and the doctor reviews the raw answers without an assessment

#### Scenario: A final-diagnosis field cannot enter the record

- **WHEN** a model response includes a field named `final_diagnosis` or any equivalent conclusion field
- **THEN** validation rejects the response outright

#### Scenario: Disclaimer is mandatory

- **WHEN** an assessment is persisted
- **THEN** it carries the mandatory disclaimer stating that it is an AI-generated decision-support
  summary based on patient-reported information, is not a medical diagnosis, has not yet been reviewed
  by a physician, and that all clinical decisions rest with the treating doctor

### Requirement: Every assessment is version-pinned and reproducible

Each stored assessment SHALL record the model identifier and version, the prompt template version, the
knowledge-base snapshot version, the retrieved entry identifiers, and the generation timestamp.

#### Scenario: Auditing a past assessment

- **WHEN** an assessment produced months earlier is examined
- **THEN** the exact model version, prompt version, knowledge-base version, and grounding entries used
  are readable from the stored record

### Requirement: Assessment generation is consent-gated and audit-logged

The pipeline SHALL verify active `ai_assisted_analysis` consent immediately before sending any
clinical content to a model provider, and SHALL audit-log the compilation, the retrieval, the call,
and the persistence of the result.

#### Scenario: Consent withdrawn between submission and processing

- **WHEN** a patient withdraws `ai_assisted_analysis` after submitting but before the pipeline runs
- **THEN** no clinical content leaves the platform boundary, the job terminates, the case is marked
  `ai_skipped`, and the skip and its reason are audit-logged

#### Scenario: Generation is recorded

- **WHEN** an assessment is generated and persisted
- **THEN** audit entries name the case, the actor as the system pipeline, the model and prompt
  versions, and the timestamp, without copying the clinical content into the audit store

### Requirement: The assessment is never delivered to the patient

The AI assessment SHALL be readable only by the assigned doctor and, under break-glass elevation, a
platform admin. No endpoint, notification, or export SHALL deliver it to a patient.

#### Scenario: Patient export excludes the assessment

- **WHEN** a patient exports their data under a data-subject access request
- **THEN** the export contains their answers, documents, and any doctor-released summary, and does not
  contain the raw AI assessment
