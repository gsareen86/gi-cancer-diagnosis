## Purpose

Turns the doctor's queue from a list into a triage instrument, and the case view into a navigable
workspace with one broad clinical reading and writing canvas rather than simultaneous narrow panels.

## ADDED Requirements

### Requirement: Stable patient and case references

Clinical views SHALL distinguish a permanent `GI` patient reference from a `GC` case reference.
UUIDs SHALL remain internal route and database identifiers, not shortened display references.

#### Scenario: Existing records retain their links

- **WHEN** the additive reference migration runs on existing patients and cases
- **THEN** each receives a unique reference, references remain stable across edits and new consultations, and existing UUID links continue to work

#### Scenario: References do not bypass privacy

- **WHEN** an unassigned doctor views the claimable queue or attempts to open a case by its reference
- **THEN** no patient reference is disclosed, and case access still requires live assignment, consent and an audit entry

### Requirement: Legible clinical review actions and AI recovery

The workspace SHALL visually separate patient identity, complaint and case state. The triage review
action SHALL be clearly labelled, keyboard reachable and unwrapped. AI failures SHALL use localized
messages, never internal reason codes, and SHALL leave manual review available.

#### Scenario: Local AI is temporarily unavailable

- **WHEN** generation cannot contact the configured service
- **THEN** a readable explanation and retry action appear, without releasing a summary or disabling manual review

#### Scenario: AI recovers

- **WHEN** the configured local model and gateway are restored and an authorized doctor retries
- **THEN** output passes the existing consent, audit and schema validation path before appearing as private decision support; no stub or external provider is substituted

#### Scenario: Narrow review layout

- **WHEN** the viewport changes between the desktop Navigator and section tabs
- **THEN** typed draft content survives and actions remain reachable without overlapping fields

### Requirement: Triage metrics

The dashboard SHALL present counts of cases awaiting review, cases the doctor has finalized,
cases acknowledged and closed, and cases past the review service level, each of which SHALL be a link into the
correspondingly filtered queue.

#### Scenario: A count opens its own subset

- **WHEN** a doctor selects the awaiting-review count
- **THEN** the triage queue opens filtered to exactly the cases that count described

#### Scenario: Overdue is emphasised

- **WHEN** any case has been awaiting review for longer than the review service level
- **THEN** the overdue count is presented in the emergency tone with the number of breaching
  cases stated in words, and is not merely a coloured number

#### Scenario: Nothing overdue

- **WHEN** no case is breaching
- **THEN** the overdue metric reads zero in a neutral tone, not an alarm tone

### Requirement: A filterable, searchable triage queue

The queue SHALL be filterable by risk tier, by case status, by service-level state, by submission date, and by
symptom area and disease-category facet, and searchable by case reference and, where the doctor
is assigned, patient name. Category facets are taxonomy groupings, not clinical diagnoses.

#### Scenario: Filters combine

- **WHEN** a doctor filters to Critical and to overdue
- **THEN** only cases matching both are listed, and the active filters are visible and
  individually clearable

#### Scenario: Filters match nothing

- **WHEN** a filter combination matches no case but the unfiltered queue is not empty
- **THEN** the queue says the filters matched nothing and offers to clear them

#### Scenario: Sorting default is preserved

- **WHEN** no explicit sort is chosen
- **THEN** cases order by risk tier and then by longest waiting, so a Critical case waiting two
  days is above a Routine case waiting three

### Requirement: Each queue row carries enough to triage without opening the case

A row SHALL show the case reference, patient age and sex, submission time and time waiting, risk
tier, case status, a one-to-two line clinical snapshot drawn from the AI assessment where one
exists, and a direct action into review.

#### Scenario: No assessment exists

- **WHEN** a case reached the queue with the AI step skipped or unavailable
- **THEN** the snapshot column states why there is no snapshot, and the row is not visually
  degraded relative to cases that have one

#### Scenario: The snapshot is not a conclusion

- **WHEN** a snapshot is shown
- **THEN** it is drawn from the model's clinician summary and is labelled as decision support,
  never presented as a diagnosis

### Requirement: The assigned doctor sees the patient's name

A doctor SHALL see the patient's name on cases currently assigned to them, and SHALL NOT see it
on unassigned cases available to claim.

#### Scenario: Claimable case stays pseudonymous

- **WHEN** a doctor views a case that nobody has claimed
- **THEN** it is identified by case reference, age and sex only

#### Scenario: Name appears on assignment

- **WHEN** a doctor claims a case
- **THEN** the patient's name becomes visible to them, the decryption happens server-side at the
  point of response, and the read is audited under the doctor-sharing consent purpose

#### Scenario: Consent withdrawn

- **WHEN** the patient withdraws the doctor-sharing consent
- **THEN** the name is no longer returned, along with the rest of the case content

### Requirement: A Navigator case workspace

The case view SHALL present patient record, reports, AI decision support and physician review as
sections selected from a persistent desktop case navigator and rendered in one broad content canvas.
The page SHALL own vertical scrolling rather than creating independently scrolling clinical panels.

#### Scenario: Moving through a case on desktop

- **WHEN** a doctor selects patient record, reports, decision support or review in the Navigator
- **THEN** exactly that broad section is shown, the selected section is stated in words, and no
  clinical content is constrained to a narrow three-column panel

#### Scenario: Moving between sections preserves work

- **WHEN** a doctor types a draft, opens another case section and returns to review
- **THEN** the same mounted editor retains the unsaved draft and current approval-invalidated state

#### Scenario: Narrow viewport

- **WHEN** the viewport cannot preserve both the navigator and a comfortable content width
- **THEN** the navigator becomes keyboard-operable section tabs with the section names visible and
  the same mounted editor preserved

#### Scenario: One predictable scroll context

- **WHEN** a section is longer than the viewport
- **THEN** the document scrolls as one surface, without nested viewport-height panel scrollbars

### Requirement: The patient-record panel presents the whole record

The panel SHALL present demographics with BMI where recorded, past medical and surgical history,
current medications with their prescription or over-the-counter classification, allergies, family
gastrointestinal history, the triggered red flags with their basis, the uploaded documents, and
the full questionnaire transcript with its branching context.

#### Scenario: Red flags are prominent

- **WHEN** a case has any triggered red flag
- **THEN** the flags appear above the history in a framed callout with their urgency stated in
  words, and are not reachable only by scrolling

#### Scenario: Documents open in place

- **WHEN** a doctor opens an uploaded report
- **THEN** it is presented in a viewer with zoom and a full-screen mode, without navigating away
  from the case

#### Scenario: An unverified extract is labelled

- **WHEN** a document carries an AI-generated extract that no clinician has confirmed
- **THEN** it is labelled unverified wherever it appears

### Requirement: The clinical record is card-based and progressively disclosed

The record SHALL separate safety alerts, measurements, history domains, reports and transcript
clusters into visually distinct cards with readable labels and summary counts. Red flags SHALL
remain expanded; disclosure SHALL hide no data from keyboard or assistive-technology users.

#### Scenario: A clinician scans the record

- **WHEN** the record opens on a wide viewport
- **THEN** urgent alerts and the measurement overview are visible first, and each history domain can be identified without reading a single dense text block

#### Scenario: A clinician follows the transcript

- **WHEN** transcript clusters are collapsed for scanability
- **THEN** each control states the cluster name and answer count, expands by keyboard, and reveals every answer and branching reason without changing stored data

### Requirement: Physician-owned editable drafts and prescribing

The review SHALL expose structured clinical impression, diagnosis, patient summary, dietary advice, precautions, referral urgency, follow-up and prescription instructions. It MAY initialize editable notes from AI output, labelled as a draft. Prescription instructions SHALL start empty and be authored by the physician. The original AI assessment SHALL remain unchanged.

The review SHALL present diagnosis, private notes, patient-facing summary and plan/follow-up as
full-width long-form editors. Save and finalize actions SHALL use compact clinician density and
remain aligned with the review content beneath the editor rather than appearing in the case navigator.

#### Scenario: Long-form clinical writing

- **WHEN** a physician writes or reviews substantial text in any primary review field
- **THEN** the editor spans the available clinical canvas width, offers a substantial initial
  writing height, and remains vertically resizable without overlapping another field

#### Scenario: Review actions stay with the review

- **WHEN** the physician reaches the end of the review editor
- **THEN** Save draft and Finalize review appear together in the content action bar with the audit
  state, and no workflow action appears beneath or inside the section navigator

#### Scenario: A physician adopts a draft

- **WHEN** an assigned, authenticated physician edits or adopts an AI-assisted draft and finalizes it
- **THEN** physician approval is recorded, and the draft remains invisible to the patient until separately dispatched

#### Scenario: The physician asks for AI writing support

- **WHEN** an editable review has an assessment and the physician opens AI assist
- **THEN** the immutable source is previewed, ungrounded status is stated, and separate actions can fill an empty summary/workup or explicitly append a non-duplicate suggestion

#### Scenario: AI assistance preserves physician work

- **WHEN** a physician applies a suggestion to a non-empty field
- **THEN** existing text is preserved, the change remains an unsaved physician draft, approval is invalidated, and no diagnosis, prescription, referral urgency or private note is generated or changed

#### Scenario: AI assistance needs a fresh assessment

- **WHEN** no assessment exists or the physician requests a refresh
- **THEN** one shared generation request runs, the interface explains that a sleeping local model may take longer to wake, and manual editing remains available if generation fails

### Requirement: The local model releases memory while idle

The configured local llama.cpp runtime SHALL use an operator-configurable idle timeout of five
minutes by default. Idle sleep SHALL unload model weights and KV cache from RAM/VRAM while keeping
the local listener available; a new inference request SHALL wake and reload it automatically.

#### Scenario: Idle expiry unloads the model

- **WHEN** no model task has arrived for the configured interval
- **THEN** the server reports sleeping and host/device model memory materially decreases without stopping unrelated processes

#### Scenario: Health checks do not keep it awake

- **WHEN** application or operator health checks run while the model is idle or asleep
- **THEN** they neither reset the idle clock nor trigger a reload, and sleeping is reported as a healthy resource-saving state

#### Scenario: Work arrives after sleep

- **WHEN** an authorized assessment request arrives while sleeping
- **THEN** the server reloads the same configured model, completes the schema-validated request within the extended timeout, and begins a new idle interval after work ends

#### Scenario: Work is active at the idle boundary

- **WHEN** one or more model tasks are active or queued when the interval elapses
- **THEN** they are not interrupted or partially persisted, and sleep occurs only after all work becomes idle

#### Scenario: Physician-authored prescriptions

- **WHEN** the physician enters medication instructions and signs off
- **THEN** the instructions survive saving, finalization, confirmation, release and PDF download without being generated by AI

#### Scenario: Unapproved release is blocked

- **WHEN** a patient, unassigned doctor, or an actor without a completed second factor attempts to finalize or dispatch
- **THEN** the API refuses the action independently of the interface

#### Scenario: Stale confirmation is blocked

- **WHEN** content changes after finalization or confirmation differs from finalized content
- **THEN** dispatch is refused until current content is finalized and confirmed again

#### Scenario: Sign and dispatch

- **WHEN** a doctor confirms finalized content
- **THEN** exact content is frozen, the chart is locked, the case advances, and notification delivery is queued

#### Scenario: Consent and audit are required

- **WHEN** the physician reads, saves, finalizes or dispatches
- **THEN** current assignment and doctor-sharing consent are checked and the operation is audited; a missing grant or failed audit prevents the operation

### Requirement: The case shows what the patient was actually told

The case view SHALL present the notification deliveries associated with the case, with their
recipient, time, and delivery outcome.

#### Scenario: Nothing actually left the process

- **WHEN** a release notification was recorded as logged-only because no mail server is
  configured
- **THEN** the case states that the patient was not emailed, distinctly from a delivered message

#### Scenario: A bounce is visible

- **WHEN** a notification hard-bounced
- **THEN** the case shows the bounce, and the release itself is unaffected
