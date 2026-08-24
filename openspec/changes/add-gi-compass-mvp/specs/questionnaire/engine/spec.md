## Purpose

Turns a versioned bank of clinician-authored questions and branching rules into an adaptive interview
that asks each patient only what their previous answers make relevant. The engine is configuration-
driven so a clinical admin can change what is asked without a code deploy, and one engine serves every
disease pathway rather than one hardcoded form per disease.

## ADDED Requirements

### Requirement: Clinical content is data, not code

Questions, question groups, options, help text, branching rules, and their attachment to reference
images SHALL be stored as data and SHALL be changeable by an authorized clinical admin without a code
change or deployment. No disease pathway SHALL be expressed as a hardcoded form.

#### Scenario: New question appears without a deploy

- **WHEN** a clinical admin adds a question to a published template version's successor and publishes
  it
- **THEN** patients starting a new case are asked the new question with no application restart or
  code change

#### Scenario: In-flight case keeps its template version

- **WHEN** a template is republished while a patient has a case in progress against the prior version
- **THEN** the in-progress case continues to be evaluated against the version it started on, so the
  patient is not shown a path that contradicts answers already given

### Requirement: Supported question types

The engine SHALL support at least these answer types: single-select, multi-select, ordinal severity
scale, numeric with unit and permitted range, date, duration, free text, body-map region selection,
and inline image capture. Each type SHALL declare a validation contract, and an answer failing that
contract SHALL be rejected rather than stored.

#### Scenario: Numeric out of range

- **WHEN** a patient submits `40` for a question declaring a range of 0–20 episodes per day
- **THEN** the answer is rejected with a message naming the permitted range and nothing is persisted

#### Scenario: Multi-select with an unknown option

- **WHEN** a submitted answer references an option identifier not defined on that question
- **THEN** the answer is rejected as invalid and the attempt is audit-logged

#### Scenario: Body-map answer

- **WHEN** a patient taps one or more regions on a body map question
- **THEN** the answer is stored as the set of selected region identifiers defined by that question's
  map, not as screen coordinates

### Requirement: Branching rules determine the next question

Each rule SHALL express a condition over one or more previously answered questions and a target
question or question group to reveal. The engine SHALL support `AND` and `OR` combinations, negation,
and chains at least five hops deep. Rule evaluation SHALL be deterministic: the same answer set SHALL
always yield the same next-question set.

#### Scenario: Multi-hop chain

- **WHEN** a patient answers "yes" to blood in stool, then "black and tarry" to its appearance, then
  "yes" to lightheadedness
- **THEN** each answer reveals its dependent question in turn, and the terminal question of that chain
  is presented without any intervening unrelated question from another group

#### Scenario: Combined condition

- **WHEN** a rule requires unintentional weight loss AND age over 45
- **THEN** the target question is revealed only when both hold, and revealing it is reproducible from
  the stored answers alone

#### Scenario: Answer change retracts a revealed branch

- **WHEN** a patient returns to an earlier question and changes the answer that had revealed a branch
- **THEN** the questions revealed only by the previous answer are withdrawn from the path, their
  stored answers are marked inactive rather than deleted, and the case's active answer set no longer
  includes them

#### Scenario: Cyclic rule is refused at publication

- **WHEN** a clinical admin attempts to publish a template whose rules make a question depend
  transitively on itself
- **THEN** publication is refused with the cycle identified, and the previously published version
  remains in effect

### Requirement: Question groups organize by symptom cluster

Questions SHALL belong to named groups representing symptom clusters — for example bowel habit,
bleeding, pain, weight and appetite, liver-related, reflux-related, personal and family history, and
medication and lifestyle — so that the same engine serves every disease pathway and so that the
doctor's review view can be organized by cluster.

#### Scenario: Entry point selects a starting group

- **WHEN** a patient chooses a symptom area such as "changes in bowel habits"
- **THEN** the engine begins at that area's entry group, and the patient is never asked to name a
  disease they might have

### Requirement: Answers autosave and the case resumes

Every accepted answer SHALL be persisted before the next question is presented. A patient SHALL be
able to close the application at any point and resume at the same position on any device.

#### Scenario: Resume after interruption

- **WHEN** a patient answers eight questions, closes the browser, and signs in again later
- **THEN** the case resumes at the ninth question with all prior answers intact

#### Scenario: Save under a dropped connection

- **WHEN** an answer submission fails because the network dropped
- **THEN** the interface keeps the answer, shows it as unsaved, and retries, and the patient is not
  advanced past a question whose answer has not been persisted

#### Scenario: Every answer write is audit-logged and consent-gated

- **WHEN** an answer is persisted
- **THEN** the write is refused unless the patient holds active `account_processing` consent, and on
  success an audit entry naming the case, the question, and the actor is written without the answer
  value

### Requirement: Progress reflects the adaptive path

The engine SHALL report progress as a function of the questions remaining on the patient's current
computed path, not as a fixed step count, and SHALL never present a progress figure that decreases
without explanation when a new branch opens.

#### Scenario: New branch opens mid-interview

- **WHEN** an answer reveals six additional questions
- **THEN** the reported progress is recomputed against the longer path and the interface indicates
  that follow-up questions were added

### Requirement: Plain language and accessibility

Every patient-facing question SHALL carry plain-language text approved by a clinician, and any
clinical term SHALL be accompanied by a lay explanation. The patient flow SHALL meet WCAG 2.1 AA,
including full keyboard operability, programmatic labelling of every control, and non-colour-dependent
conveyance of meaning.

#### Scenario: Screen reader traversal

- **WHEN** a screen reader user moves through a question with reference images
- **THEN** the question text, its lay explanation, each option, and each image's alternative text are
  announced, and the images are not required to answer

#### Scenario: Unexplained clinical term is refused at publication

- **WHEN** a clinical admin publishes a question containing a term marked as clinical jargon with no
  lay explanation
- **THEN** publication is refused until the explanation is supplied
