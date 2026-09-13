## Purpose

Gives every workspace one visual and interaction vocabulary, with a stated contrast contract and
a risk scale derived from clinical data rather than chosen per screen, so "which colour, which
word, which density" has an answer that is checkable instead of aesthetic.

## ADDED Requirements

### Requirement: Every foreground token meets WCAG 2.1 AA against its own background

Each semantic colour SHALL be defined as a `DEFAULT` used for text and for fills carrying white
text, and a `bright` used only where nothing is read against it. The `DEFAULT` SHALL reach at
least 4.5:1 against `surface` and against white.

#### Scenario: An accent used as body text

- **WHEN** a component renders `text-accent` on `surface`
- **THEN** the resulting pair measures at least 4.5:1

#### Scenario: An accent used as a button fill

- **WHEN** a component renders white text on `bg-accent`
- **THEN** the resulting pair measures at least 4.5:1

#### Scenario: A bright token is used decoratively

- **WHEN** a progress bar, focus ring, or active-tab underline uses a `bright` token
- **THEN** no text is rendered against it, and removing the colour still leaves the state
  distinguishable by shape or position

### Requirement: Risk tier is derived from triggered flags, never stored

The interface SHALL present four risk tiers — Critical, High, Moderate, Routine — computed from
a case's highest triggered red-flag urgency, with Routine meaning no flag triggered. The mapping
SHALL exist in exactly one module.

#### Scenario: A case with an emergency flag

- **WHEN** a case's highest triggered urgency is `emergency`
- **THEN** it presents as Critical, in the emergency tone, with the word "Critical" beside it

#### Scenario: A case with no flags

- **WHEN** a case has no triggered red flags
- **THEN** it presents as Routine, and is not styled as an absence or an error state

#### Scenario: Tier cannot disagree with its flags

- **WHEN** a case's red flags change
- **THEN** its tier changes with them on the next read, because no tier value is persisted

### Requirement: Meaning is never carried by colour alone

Every risk tier, case status, and notification delivery state SHALL be rendered with a word in
the reader's language alongside any colour, shape, or position cue.

#### Scenario: Rendered without colour

- **WHEN** the interface is viewed in greyscale or by a reader who cannot distinguish the tones
- **THEN** every tier, status, and delivery state remains identifiable from its text

### Requirement: Two densities from one token set

The clinician workspace SHALL render at a compact density and the patient workspace at a
comfortable density, selected by an attribute on the workspace shell rather than by a prop on
each component.

#### Scenario: Patient touch targets are preserved

- **WHEN** a patient answers a question on a phone
- **THEN** every interactive control is at least 44px in its smallest dimension

#### Scenario: Clinician density does not leak into the patient tree

- **WHEN** a patient page renders
- **THEN** no compact-density rule applies to it, whatever the viewport

### Requirement: Loading, empty, and error states are first-class

Every view that fetches SHALL render a skeleton matching the shape of its eventual content;
every collection that can be empty SHALL render an explanatory empty state with the action that
would fill it; every user-initiated action SHALL confirm its outcome.

#### Scenario: A queue with no cases

- **WHEN** a doctor's triage queue returns no rows
- **THEN** an empty state explains that nothing is awaiting review, rather than showing a blank
  region or a zero-row table

#### Scenario: A filter that matches nothing

- **WHEN** a filter combination matches no cases but the unfiltered queue is not empty
- **THEN** the empty state says the filters matched nothing and offers to clear them, which is a
  different state from having no cases at all

#### Scenario: An action reports its outcome

- **WHEN** a user saves, claims, finalises, releases, uploads, or signs out
- **THEN** a toast states what happened, in the reader's language, and is announced to assistive
  technology

### Requirement: All display text comes from the message catalogue

No component in the design system SHALL contain a default display string.

#### Scenario: A primitive is rendered without text

- **WHEN** a primitive that displays text is used
- **THEN** its text arrives as a prop from the caller, and the component has no fallback prose

### Requirement: Dense clinical data remains scannable

Clinical record domains SHALL use consistent card anatomy: icon/title, concise status or count,
primary values, secondary context, and an explicit disclosure label where details collapse.

#### Scenario: Cards are viewed without colour

- **WHEN** measurement, history and report cards are viewed without colour
- **THEN** headings, labels, values, counts and states still communicate the complete hierarchy

#### Scenario: Reduced motion is requested

- **WHEN** the operating system requests reduced motion
- **THEN** card, disclosure and AI-assist transitions do not animate, without affecting visibility or operation
