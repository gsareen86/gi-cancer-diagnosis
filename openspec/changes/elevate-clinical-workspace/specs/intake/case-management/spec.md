## Purpose

Presents the existing questionnaire engine as a staged intake a patient can orient inside, and
gives them a case view that tells them where their case actually is.

## ADDED Requirements

### Requirement: The intake is presented as named stages

The interview SHALL be presented within a progress rail of named stages, showing which stage the
current question belongs to and which stages remain.

#### Scenario: The stage rail reflects the current question

- **WHEN** a patient is answering a question whose cluster maps to pain mapping
- **THEN** the rail shows the pain-mapping stage as current, earlier stages as done, and later
  stages as remaining

#### Scenario: A branch opens mid-stage

- **WHEN** an answer opens a branch and the number of questions grows
- **THEN** the rail does not appear to move backwards, and the interface says that answers have
  opened further questions

#### Scenario: The engine contract is unchanged

- **WHEN** a patient answers a question inside the wizard
- **THEN** the answer is persisted before anything advances, and a failed save leaves the answer
  on screen and editable, exactly as before

#### Scenario: An emergency interrupts the wizard

- **WHEN** an answer triggers an emergency red flag
- **THEN** the advisory takes over the screen ahead of the rail and the current stage, from the
  same response that saved the answer

### Requirement: Visual reference aids for localisation and severity

The intake SHALL offer an interactive abdominal-region selector for pain localisation, and visual
scales for severity and for stool form, each labelled in words as well as depicted.

#### Scenario: Selecting a region

- **WHEN** a patient selects one or more abdominal regions
- **THEN** each selection is announced by its clinical name and can be changed by keyboard alone

#### Scenario: The visual is not the only affordance

- **WHEN** the reference imagery fails to load
- **THEN** every option remains selectable and identifiable from its text

### Requirement: Drag-and-drop report upload with visible progress

The upload stage SHALL accept files by drag-and-drop and by file picker, show per-file progress,
present a thumbnail or type indicator for each accepted file, and allow removal before submission.

#### Scenario: A rejected file explains itself

- **WHEN** a file is refused for size, type, extension mismatch, or scan result
- **THEN** the reason is stated against that file, and other files in the same batch are
  unaffected

#### Scenario: Upload without a pointer

- **WHEN** a patient uses the keyboard only
- **THEN** the file picker is reachable and operable, and drag-and-drop is an addition rather than
  the only route

#### Scenario: Removal before submission

- **WHEN** a patient removes an uploaded file before submitting
- **THEN** it is deleted from the case and no longer visible to the reviewing doctor

### Requirement: The patient sees their case as a timeline

The case view SHALL present real progress as ordered milestones — submitted, AI analysis,
specialist review, summary ready — derived from persisted case and processing state.

#### Scenario: Processing progress does not reveal clinical output

- **WHEN** a case is in an AI processing or AI processed state
- **THEN** the patient sees pending or completed processing separately from specialist review,
  without findings or assessment text; failed/skipped processing is labelled unavailable rather
  than complete, and does not prevent specialist review

#### Scenario: No clinical content before release

- **WHEN** a case has an AI assessment but has not been released by a doctor
- **THEN** the patient's view shows state only, with no differential, no red-flag list, and no
  model output

#### Scenario: Released summary

- **WHEN** a doctor releases the review
- **THEN** the patient sees the doctor's summary, diagnosis, dietary advice, precautions, referral
  urgency, follow-up and physician-authored prescription instructions, together with the standing notice, and can download an official PDF containing exactly the frozen content and notice

### Requirement: Past consultations remain reachable

The patient workspace SHALL list prior cases with their date, symptom area, and outcome state,
and open each to its released summary where one exists.

#### Scenario: A prior released case

- **WHEN** a patient opens a case released last year
- **THEN** they see exactly the content that was frozen at release, not a regenerated summary
### Requirement: Patient acknowledgement closes the case

A released summary SHALL remain available after the patient acknowledges receipt. Acknowledgement SHALL close the case without changing released content.

#### Scenario: Acknowledgement

- **WHEN** the owning patient acknowledges a released summary
- **THEN** the case becomes closed and the action is audited under account-processing consent

#### Scenario: No acknowledgement before release

- **WHEN** a case has no physician-released summary
- **THEN** acknowledgement is refused

#### Scenario: Audited PDF access

- **WHEN** a patient downloads their official summary
- **THEN** ownership and consent gates run, the read is audited, and only frozen released fields are rendered with no shared cache
