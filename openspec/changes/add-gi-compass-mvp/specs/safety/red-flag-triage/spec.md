## Purpose

Detects, from the answers themselves, patterns that need urgent in-person care — ongoing GI bleeding,
possible obstruction or perforation, severe dehydration, syncope with bleeding — and tells the patient
to seek emergency care immediately. It is deterministic, synchronous, and completely independent of
the AI pipeline, because a patient who may be bleeding cannot wait for a model call.

## ADDED Requirements

### Requirement: Red-flag evaluation is deterministic and synchronous

Red-flag rules SHALL be evaluated by deterministic logic over the stored answers, SHALL run
synchronously as part of persisting each answer, and SHALL complete within 100 ms at the 99th
percentile. The same answer set SHALL always produce the same red-flag result.

#### Scenario: Evaluation on every answer

- **WHEN** a patient submits any answer
- **THEN** the full red-flag rule set is evaluated against the case's active answers before the
  response to that submission is returned

#### Scenario: Reproducibility

- **WHEN** the same set of answers is evaluated twice
- **THEN** the same set of triggered flags, with the same urgency levels, is produced both times

### Requirement: The AI pipeline is never on the emergency critical path

Emergency escalation SHALL NOT depend on, wait for, or be triggered by any model call, network call to
an external provider, or asynchronous job.

#### Scenario: Model provider is unreachable

- **WHEN** the AI service is entirely unavailable and a patient answers a question that triggers an
  emergency-level flag
- **THEN** the emergency escalation is shown immediately and correctly, with no degradation

#### Scenario: Escalation must not be derived from model output

- **WHEN** the AI pipeline returns a red-flag list in its assessment
- **THEN** that list is treated as information for the reviewing doctor only and SHALL NOT by itself
  raise, lower, or suppress the patient-facing emergency escalation, which is determined solely by the
  deterministic rules

### Requirement: Emergency escalation interrupts the flow

When a rule of urgency `emergency` triggers, the system SHALL immediately present a full-screen,
unmissable message advising the patient to seek emergency care now, including India's emergency
number 112 and the ambulance number 108, and offering to notify a recorded emergency contact if one
exists.

#### Scenario: Emergency banner is shown

- **WHEN** an `emergency` rule triggers
- **THEN** the interview is interrupted with a full-screen advisory that cannot be dismissed by an
  accidental tap, showing 112 and 108 as tap-to-call actions

#### Scenario: Answers are still saved

- **WHEN** an emergency escalation is shown
- **THEN** every answer given so far, including the triggering one, remains saved for the eventual
  doctor review, and the case is flagged urgent in the doctor queue

#### Scenario: Patient chooses to continue

- **WHEN** the patient explicitly acknowledges the advisory and chooses to continue the interview
- **THEN** the acknowledgement is recorded with its timestamp, the interview resumes, and a persistent
  banner remains visible for the rest of the session

### Requirement: Escalation messages are symptom-based, never condition-based

The escalation SHALL describe the pattern of answers and the need for urgent in-person care, and SHALL
NOT name or suggest a diagnosis.

#### Scenario: Wording contains no condition claim

- **WHEN** an escalation for a bleeding pattern is shown
- **THEN** the message states that the answers suggest a pattern needing urgent in-person care and does
  NOT state or imply a condition such as perforation, cancer, or a bleeding ulcer

#### Scenario: Condition-naming content is refused at publication

- **WHEN** a clinical admin saves a red-flag message containing a term from the disease taxonomy
- **THEN** publication is refused with the offending term identified

### Requirement: Rules are clinician-authored configuration

Red-flag rules SHALL be stored as versioned configuration authored by a clinical admin, each with an
identifier, a human-readable basis, an urgency of `emergency`, `urgent`, or `routine-but-flagged`, and
a condition over answers. Changing a rule SHALL NOT require a code change.

#### Scenario: Rule version is pinned to the evaluation

- **WHEN** a red flag triggers on a case
- **THEN** the stored trigger record names the rule identifier and the rule-set version that produced
  it, so the decision can be reconstructed later

#### Scenario: Combination rule

- **WHEN** a rule requires black tarry stool AND (lightheadedness OR fainting)
- **THEN** it triggers only when the combination holds, and the recorded basis names each contributing
  answer

### Requirement: Flags reach the doctor regardless of patient action

Triggered flags SHALL be attached to the case and surfaced in the doctor's queue with their urgency,
whether or not the patient acknowledged the advisory and whether or not the case was ever submitted.

#### Scenario: Patient abandons after an emergency flag

- **WHEN** an `emergency` flag triggers and the patient closes the application without submitting
- **THEN** the case appears in the doctor's queue marked urgent and unsubmitted, so the flag is not
  lost to abandonment
