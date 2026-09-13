## Purpose

Ensures every word a patient reads can be translated, so the product can serve English and Hindi from
the first release and add languages later without a rewrite. Clinical wording is translated by a
clinician, not by a machine, because a mistranslated symptom question produces a wrong answer.

## ADDED Requirements

### Requirement: No patient-facing string is hardcoded

Every patient-facing string SHALL be resolved through the localization layer from a message catalogue
keyed by identifier. This includes interface text, validation messages, error messages, notification
templates, red-flag escalation copy, and consent text.

#### Scenario: Hardcoded string fails the build

- **WHEN** a patient-facing component contains literal display text rather than a catalogue key
- **THEN** the lint or build step fails, so the omission is caught before release

#### Scenario: Missing translation falls back visibly

- **WHEN** a key has no entry in the selected language
- **THEN** the English text is shown, the gap is recorded, and no key identifier or empty string is
  shown to the patient

### Requirement: English and Hindi at launch

The patient flow SHALL be fully available in English and Hindi, including question text, answer
options, help text, reference-image captions and alternative text, consent text, and red-flag copy.

#### Scenario: Language switch mid-case

- **WHEN** a patient switches language partway through an interview
- **THEN** the remaining questions and all previously answered questions render in the new language,
  and the stored answers are unchanged because they are stored as option identifiers rather than as
  display text

### Requirement: Clinical content is translated by a clinician

Translations of question text, answer options, consent text, and red-flag copy SHALL be entered and
approved through the clinical content tools by an authorized clinical admin, and SHALL NOT be
machine-translated at runtime.

#### Scenario: Publishing with an unapproved clinical translation

- **WHEN** a template is published with a question whose Hindi text has not been marked clinician-
  approved
- **THEN** publication is refused for that language, and the language is not offered for that template
  until the approval exists

#### Scenario: Runtime machine translation is not offered

- **WHEN** a language is requested for which approved clinical content does not exist
- **THEN** the language is not offered, rather than being served through automatic translation of
  clinical questions

### Requirement: Locale-correct formatting

Dates, numbers, and durations SHALL be formatted for the selected locale, and dates entered by
patients SHALL be unambiguous regardless of locale.

#### Scenario: Ambiguous date entry

- **WHEN** a patient enters a date such as 03/04/2026
- **THEN** the interface captures it through controls that make the day, month, and year explicit, so
  the stored value cannot be misread by the doctor
