## Purpose

Tells patients and doctors when something needs their attention — verify your email, your case was
received, your case has been reviewed — without ever putting clinical content into a channel the
platform does not control.

## ADDED Requirements

### Requirement: Phase 1 transactional notifications

The system SHALL send email for account verification, password reset, case submission confirmation,
and case-reviewed-and-released notification, and SHALL notify the assigned doctor when a case enters
their queue.

#### Scenario: Release notification

- **WHEN** a doctor releases a summary
- **THEN** the patient receives an email telling them a reviewed summary is available and inviting them
  to sign in to read it

#### Scenario: Urgent case notification to the doctor

- **WHEN** a case carrying an `emergency` red flag enters a doctor's queue
- **THEN** the doctor is notified promptly and the notification names the case reference and urgency
  without clinical detail

### Requirement: Notifications carry no clinical content

No notification SHALL contain questionnaire answers, document content, red-flag detail, AI assessment
content, or any released clinical summary. Notifications SHALL direct the recipient to sign in.

#### Scenario: Attempted clinical content in a template

- **WHEN** a notification template is rendered with a variable holding clinical content
- **THEN** rendering fails and the notification is not sent, rather than leaking the content to email

#### Scenario: Subject line reveals nothing

- **WHEN** a review-ready email is sent
- **THEN** neither its subject nor its body names a condition, a symptom, or a finding

### Requirement: Delivery is recorded and failures are visible

Each notification attempt SHALL be recorded with its type, recipient reference, timestamp, and
outcome. A permanent delivery failure SHALL be surfaced to an operator, and SHALL NOT silently block
the underlying clinical workflow.

#### Scenario: Bounced release notification

- **WHEN** a release notification hard-bounces
- **THEN** the release itself stands, the failure is recorded and surfaced, and the patient can still
  see the released summary on signing in

### Requirement: Notifications respect consent and role

The system SHALL send only notifications necessary for the service relationship, SHALL send no
marketing message, and SHALL address each notification only to the account it concerns.

#### Scenario: Notification after account deletion

- **WHEN** a queued notification would be sent to an account whose data has been erased
- **THEN** the notification is dropped and the drop is recorded
