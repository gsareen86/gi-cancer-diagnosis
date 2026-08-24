## Purpose

Lets the clinical admin own the clinical content of the product — questions, branching rules, reference
images, red-flag rules, the disease taxonomy, and knowledge-base entries — with version history and a
patient's-eye preview, so the clinician can change what the platform asks and how it escalates without
waiting on an engineer.

## ADDED Requirements

### Requirement: Content authoring covers the whole question bank

A clinical admin SHALL be able to create, edit, reorder, and retire questions, question groups, answer
options, help text, reference-image attachments, and branching rules.

#### Scenario: Retiring a question in use

- **WHEN** an admin retires a question that in-progress cases have already answered
- **THEN** the question stops appearing in new cases, in-progress cases against the prior template
  version are unaffected, and the historical answers remain readable

### Requirement: Changes are versioned and published deliberately

Content SHALL be edited in a draft template version and SHALL become visible to patients only on an
explicit publish. Publishing SHALL create an immutable version, and a published version SHALL NOT be
edited in place.

#### Scenario: Draft is invisible to patients

- **WHEN** an admin edits a draft
- **THEN** no patient sees the change until the draft is published

#### Scenario: Publication validates the whole template

- **WHEN** an admin publishes a draft containing a rule targeting a retired question, a cycle in the
  branching graph, or a question missing a lay explanation for a clinical term
- **THEN** publication is refused with each problem identified, and the currently published version
  remains in effect

#### Scenario: Rollback

- **WHEN** an admin needs to revert to a prior published version
- **THEN** that version can be republished as the current one, and the history records both events

### Requirement: Preview walks the real patient path

The admin SHALL be able to walk a draft template exactly as a patient would, including live branching
and reference images, without creating a case or writing any patient data.

#### Scenario: Preview writes nothing

- **WHEN** an admin completes a preview run
- **THEN** no case, response, or assessment is created, and the preview session is discarded

#### Scenario: Preview exercises red-flag rules

- **WHEN** an admin answers a preview path that satisfies an `emergency` rule
- **THEN** the preview shows the escalation the patient would see, marked as a preview

### Requirement: Admins cannot reach patient clinical data through content tools

No content-management view, export, or preview SHALL expose a patient's answers, documents,
assessments, or reviews.

#### Scenario: Question usage statistics

- **WHEN** an admin views how often a question is answered
- **THEN** only aggregate counts over a minimum cohort size are shown, with no individual answer and no
  patient identifier, and the view is audit-logged

### Requirement: Every content change is attributed and audit-logged

Each create, edit, publish, retire, and rollback SHALL record the acting admin, the timestamp, and the
before-and-after content.

#### Scenario: Tracing a clinical content change

- **WHEN** a question's wording is found to be misleading
- **THEN** the history shows who changed it, when, what it said before, and which template versions
  carried each wording
