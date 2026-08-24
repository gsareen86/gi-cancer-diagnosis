## Purpose

Gives patients a visual reference point — a stool-form chart, a body map, blood-appearance comparisons,
a jaundice reference — so that answers to subjective questions are comparable between patients. The
library is centrally managed, attributed, and delivered small enough to load on a slow mobile
connection.

## ADDED Requirements

### Requirement: Reference images are a managed library

Reference images SHALL be stored in a central library where each asset carries a caption, alternative
text, the identifiers of the questions it is attached to, its clinical source and licence attribution,
and a version. An image SHALL be attachable to many questions.

#### Scenario: Asset requires attribution before publication

- **WHEN** a clinical admin publishes an asset without a recorded source and licence
- **THEN** publication is refused, because assets must be licensed or clinician-supplied originals
  rather than scraped clinical images

#### Scenario: Replacing an image preserves history

- **WHEN** an admin uploads a corrected version of an existing asset
- **THEN** a new version is created, questions referencing the asset resolve to the new version for
  new cases, and the prior version remains retrievable for cases answered against it

### Requirement: Images are delivered for low bandwidth

Reference images SHALL be served from a CDN in multiple responsive sizes and a modern compressed
format with fallbacks, SHALL be lazy-loaded, and SHALL NOT be embedded at full resolution in the
questionnaire payload.

#### Scenario: Questionnaire payload size

- **WHEN** a question carrying four reference images is fetched
- **THEN** the payload carries image references and alternative text only, and no image binary

#### Scenario: Slow connection

- **WHEN** a patient on a constrained connection reaches an image-assisted question
- **THEN** the question text and options are usable before any image has loaded, and each image loads
  progressively at a size appropriate to the viewport

### Requirement: Images never carry patient content

The reference library SHALL contain only clinical illustration assets. Patient-supplied images SHALL
NOT be stored in it under any circumstance.

#### Scenario: Patient image upload is routed away from the library

- **WHEN** a patient answers an inline image-capture question
- **THEN** the image is stored in encrypted patient document storage under the case, and no write is
  made to the reference library
