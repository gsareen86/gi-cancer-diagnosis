## Purpose

Holds the reviewing doctor's own clinical guidance — diagnostic criteria, red-flag checklists, and the
"this pattern of answers suggests this differential" heuristics — as versioned, embedded, retrievable
entries. This is what makes the assessment reflect the doctor's judgement rather than a model's
unguided one.

## ADDED Requirements

### Requirement: Entries are doctor-authored and attributed

A knowledge-base entry SHALL record its title, content, disease tags, source or citation, author, and
creation time. Only a `clinical_admin` or a `doctor` SHALL create or edit entries.

#### Scenario: Unauthorized authorship

- **WHEN** a platform admin attempts to create a knowledge-base entry
- **THEN** the request is refused and audit-logged

### Requirement: Entries are versioned, never silently overwritten

Editing an entry SHALL create a new version and retain the prior one. The knowledge base as a whole
SHALL carry a snapshot version that advances when any entry changes, so an assessment can name exactly
which state of the knowledge base it was grounded on.

#### Scenario: Edit creates a version

- **WHEN** a doctor revises the content of an entry
- **THEN** a new version is stored, the previous version remains retrievable, and the knowledge-base
  snapshot version advances

#### Scenario: Reconstructing past grounding

- **WHEN** an assessment naming an earlier snapshot version is examined
- **THEN** the entry contents as they were at that snapshot are retrievable

### Requirement: Entries are embedded for retrieval

Each entry version SHALL be chunked and embedded so it can be retrieved by semantic similarity against
a case's structured summary, and SHALL also be filterable by disease tag and symptom cluster.

#### Scenario: Re-embedding on edit

- **WHEN** an entry's content changes
- **THEN** its embeddings are regenerated before that version becomes retrievable, so retrieval never
  matches stale content

#### Scenario: Tag-filtered retrieval

- **WHEN** retrieval runs for a case whose answers point at the hepatobiliary cluster
- **THEN** entries tagged for that cluster are preferred over semantically similar entries from an
  unrelated cluster

### Requirement: The disease taxonomy is explicit and reviewable

The set of conditions the platform screens for SHALL be stored as an explicit, versioned taxonomy —
not implied by prompt text — and SHALL be readable and editable by a clinical admin. Phase 1 covers
Crohn's disease, ulcerative colitis, peptic ulcer disease, GERD and its complications, diverticular
disease, pancreatitis, and liver disease including cirrhosis; GI cancers — oesophageal, gastric,
colorectal, pancreatic, and hepatic — are represented as a single "needs urgent specialist review"
category rather than as subtypes the model is asked to differentiate.

#### Scenario: Taxonomy is inspectable

- **WHEN** a clinical admin opens the taxonomy
- **THEN** every condition in scope is listed with its status, its tags, and the knowledge-base entries
  and questions attached to it

#### Scenario: Model may not invent a condition outside the taxonomy

- **WHEN** a model response names a differential condition not present in the current taxonomy
- **THEN** the response is rejected and retried, so the screening scope stays the one the clinician
  reviewed

#### Scenario: Cancer subtype differentiation is refused

- **WHEN** a model response attempts to differentiate between GI cancer subtypes
- **THEN** the response is rejected, because the taxonomy exposes only the single urgent-referral
  category for malignancy

### Requirement: Knowledge-base content contains no patient data

Entries SHALL hold clinical guidance only. The system SHALL NOT write patient answers, documents, or
assessments into the knowledge base, whether manually or as part of any improvement loop.

#### Scenario: Attempted import of case content

- **WHEN** any code path attempts to create a knowledge-base entry from case content
- **THEN** the write is refused and audit-logged
