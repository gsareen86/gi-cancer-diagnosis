## Purpose

Makes the notifications the platform already sends visible inside it, and makes their real
delivery outcome visible on the case, so nobody has to assume that a message sent was a message
received.

## ADDED Requirements

### Requirement: An in-app notification centre

Each signed-in user SHALL have a notification control in the shell showing the count of their
unread notifications, opening to a list of their own notifications newest first.

#### Scenario: Unread count

- **WHEN** a user has notifications they have not opened
- **THEN** the count is shown on the control and is announced to assistive technology as a count,
  not as decoration

#### Scenario: Opening marks read

- **WHEN** a user opens the notification centre
- **THEN** the listed notifications are marked read and the count clears, while the underlying
  delivery records keep their original delivery outcome unchanged

#### Scenario: A notification links to its subject

- **WHEN** a notification concerns a case
- **THEN** selecting it opens that case in the user's own workspace

### Requirement: Notifications carry no clinical content, in-app as well as by email

The in-app feed SHALL render from the same non-clinical record as the email, and SHALL NOT
introduce any field carrying findings, answers, or assessment content.

#### Scenario: The feed is built from the delivery record

- **WHEN** the feed renders an entry
- **THEN** it uses the notification type, its time, and a case reference, and no clinical value is
  available to it to render

### Requirement: Doctor alerts distinguish urgency

A doctor SHALL be alerted when a case is assigned to them and, separately and distinguishably,
when an assigned case is flagged urgent or has passed the review service level.

#### Scenario: An urgent assignment

- **WHEN** a case with an emergency or urgent red flag is assigned to a doctor
- **THEN** its notification is presented in the urgent tone with its urgency stated in words

#### Scenario: A routine assignment

- **WHEN** an unflagged case is assigned
- **THEN** its notification is presented neutrally and is not indistinguishable from an urgent one

### Requirement: Per-case delivery audit

A case SHALL show the notifications sent in connection with it, each with its recipient role,
time, and delivery outcome.

#### Scenario: Delivery outcome is stated honestly

- **WHEN** a notification was recorded as logged-only because no mail server is configured
- **THEN** the case states that nothing was delivered, in words, distinctly from a message handed
  to a mail server

#### Scenario: Outcome vocabulary stops at what can be asserted

- **WHEN** the delivery audit renders
- **THEN** it presents only states the platform can establish — queued, sent, not sent, bounced,
  dropped — and asserts nothing about whether a message was opened

#### Scenario: A failed notification does not fail the clinical action

- **WHEN** a release notification bounces
- **THEN** the release stands, the case shows the bounce, and the patient's summary remains
  available to them on signing in
