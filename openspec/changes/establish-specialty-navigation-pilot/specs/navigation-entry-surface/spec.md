## Purpose

Present the revised specialty-navigation purpose and a clearly limited demonstration
with layouts that work on desktop, tablet and phone without promising an active pilot.

## ADDED Requirements

### Requirement: Current purpose and audience separation are visible

The entry surface SHALL describe structured history, optional existing reports and
clinician-reviewed specialty navigation. It SHALL not advertise early detection,
cancer screening, named-doctor recommendations or autonomous diagnosis. It SHALL
distinguish the patient artifact from the clinician-only AI hypothesis, and describe
Metro as a proposed site only where site context is needed.

#### Scenario: Visitor reads the entry page
- **WHEN** a visitor opens the application
- **THEN** they can understand the intended purpose and the demonstration status before entering a workflow
- **AND** the page makes no promise of real-time clinical review, a confirmed hospital partnership or a diagnostic result

#### Scenario: Demonstrate a patient with no reports
- **WHEN** the visitor views the no-report example
- **THEN** the preview contains a useful symptom/history brief with explicit missing information
- **AND** it does not imply that reports, lab tests or a patient email account are prerequisites for the planned clinic intake

### Requirement: Demonstration choices represent the clinic workflow honestly

The entry SHALL explain patient self-service and coordinator-assisted tablet use.
It SHALL identify implemented example actions and planned workflow steps distinctly;
it SHALL not link to an enabled patient-data intake while the operating boundary is
closed. Its patient preview SHALL contain navigation instructions without the AI
differential, while a separately labelled clinician example can show hypotheses.

#### Scenario: Planned assistance flow
- **WHEN** the visitor inspects coordinator-assisted entry
- **THEN** the preview describes an authorised coordinator helping the patient
- **AND** it does not treat the coordinator's relationship or account as patient consent

#### Scenario: Patient artifact preview
- **WHEN** the patient preview is rendered or exported
- **THEN** it contains the example specialty, reviewed next steps and uncertainty wording
- **AND** no AI differential, cancer probability or staging assertion is included

### Requirement: Layout adapts to the actual device

The entry and example views SHALL be usable at 1440×900 desktop, 1024×768 landscape
tablet, 768×1024 portrait tablet and 390×844 phone viewport sizes. Desktop SHALL use
the available width for parallel explanatory/preview regions. Tablet and phone SHALL
preserve reading order, visible primary controls, keyboard operation, readable labels
and touch targets of at least 44 CSS pixels for main actions, without page overflow.

#### Scenario: Desktop and tablet verification
- **WHEN** the entry and examples are viewed at all four target sizes
- **THEN** text and primary actions remain visible with no horizontal page scrolling
- **AND** desktop content is not a narrow phone column stretched across an empty page

#### Scenario: Keyboard and zoom
- **WHEN** a visitor navigates by keyboard or at 200 percent zoom
- **THEN** focus order is meaningful, focus is visible and no action or meaning depends only on an image or colour

### Requirement: Honest language and image availability

Visible strings SHALL use the existing localisation mechanism. A clinical locale
SHALL not be advertised as approved merely because translation text exists. Missing
reference images SHALL have useful text/placeholder content and no disappearing link.
No medical image SHALL be published without recorded reuse rights and clinical approval.

#### Scenario: Placeholder image
- **WHEN** a referenced picture is not approved or cannot load
- **THEN** the visitor still sees an understandable description and honest availability text
- **AND** there is no dead “compare with these pictures” instruction

#### Scenario: Unapproved Hindi clinical content
- **WHEN** translation files exist but clinical sign-off is missing
- **THEN** the entry does not promise an approved Hindi clinical questionnaire
