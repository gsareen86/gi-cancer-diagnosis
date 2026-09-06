## Purpose

Captures the past medical and surgical history, current medication, allergies, family GI history
and anthropometry that a reviewing doctor needs to read a presenting complaint correctly, anchored
to the case so a signed review always describes the record it was made against.

## ADDED Requirements

### Requirement: Clinical history is recorded per case, not per patient

Each case SHALL support its own clinical-history record, created on the first history save and
frozen when the case is submitted. An absent record SHALL mean not recorded, not a negative history.

#### Scenario: A second case does not inherit a mutable record

- **WHEN** a patient opens a new case months after an earlier one
- **THEN** the new case has its own history record, pre-fillable from the earlier one but stored
  separately, and editing it does not change what the earlier case's reviewer saw

#### Scenario: History is frozen at submission

- **WHEN** a patient attempts to change their clinical history after submitting the case
- **THEN** the change is refused with the same not-editable outcome that applies to answers

### Requirement: The history covers the fields a GI history depends on

The record SHALL capture comorbidities, prior gastrointestinal and abdominal surgery, current
prescription and over-the-counter medication, allergies, family gastrointestinal history, height
and weight, and smoking and alcohol use.

#### Scenario: Over-the-counter analgesia is capturable

- **WHEN** a patient records regular ibuprofen use
- **THEN** it is stored as a medication with its over-the-counter classification and is shown to
  the reviewing doctor with that classification visible

#### Scenario: Recording a medication is not prescribing

- **WHEN** a patient's history names a medication
- **THEN** medication history is accepted as patient-reported information, independently of
  the prohibition on autonomous AI prescribing, and does not block submission

#### Scenario: Common conditions are coded, uncommon ones are not lost

- **WHEN** a patient selects a condition outside the coded list
- **THEN** it is stored with free text preserved, and is shown to the doctor exactly as written

### Requirement: BMI is computed, never stored

Body mass index SHALL be derived from the recorded height and weight at the moment of display.

#### Scenario: Only one measurement recorded

- **WHEN** height is recorded but weight is not
- **THEN** no BMI is shown, and the missing measurement is named rather than the section
  appearing empty

#### Scenario: BMI agrees with its inputs

- **WHEN** a patient corrects their weight before submission
- **THEN** the BMI shown to the doctor reflects the corrected weight, because no BMI value was
  persisted

### Requirement: The history step is optional but its absence is visible

A patient SHALL be able to submit a case without completing the history step, and the reviewing
doctor SHALL be told that it was not completed rather than shown an empty section.

#### Scenario: Skipped by the patient

- **WHEN** a patient submits without completing the history step
- **THEN** the doctor's patient-record panel states that history was not recorded, and does not
  render as though the patient reported no conditions

#### Scenario: A case predating this capability

- **WHEN** a doctor opens a case created before clinical history existed
- **THEN** the panel states that no history was captured for this case

### Requirement: History reads and writes are consent-gated and audited

Every read and write of the clinical-history record SHALL pass through the same access context as
questionnaire responses.

#### Scenario: The doctor reads the history

- **WHEN** an assigned doctor loads the patient-record panel
- **THEN** the read is audited with the doctor as actor under the doctor-sharing purpose, and is
  refused if that consent is not active

#### Scenario: The patient writes their own history

- **WHEN** a patient saves the history step
- **THEN** the write is audited with the patient as actor under the account-processing purpose
