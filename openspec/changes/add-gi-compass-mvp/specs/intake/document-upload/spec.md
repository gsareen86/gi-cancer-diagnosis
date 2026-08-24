## Purpose

Lets a patient bring their existing medical record — lab reports, endoscopy and imaging reports, past
prescriptions, discharge summaries — into the case, stores it under encryption in an India region, and
extracts a structured summary for the reviewing doctor while always preserving the original as the
source of truth.

## ADDED Requirements

### Requirement: Accepted uploads

The system SHALL accept PDF, JPEG, PNG, and DOCX files up to a configured per-file size limit, SHALL
reject other types, and SHALL determine type from content inspection rather than from the filename
extension alone.

#### Scenario: Executable renamed to a PDF

- **WHEN** a file whose content is not a PDF is uploaded with a `.pdf` name
- **THEN** the upload is rejected on content inspection, nothing is stored, and the attempt is
  audit-logged

#### Scenario: Oversized file

- **WHEN** a file exceeding the configured limit is uploaded
- **THEN** the upload is refused before the whole body is accepted and the patient is told the limit

### Requirement: Uploads are scanned before they are stored

Every uploaded file SHALL be scanned for malware before it is written to durable patient storage. A
file that fails scanning SHALL be discarded and SHALL NOT be retrievable by the patient or the doctor.

#### Scenario: Infected upload

- **WHEN** a file fails the malware scan
- **THEN** it is discarded, the patient is told the file could not be accepted, no reference is
  attached to the case, and the event is audit-logged

#### Scenario: Scanner unavailable

- **WHEN** the scanner cannot be reached
- **THEN** the upload is held as pending rather than stored as accepted, and it is not exposed to the
  doctor until scanning succeeds

### Requirement: Storage is encrypted, private, and India-resident

Uploaded files SHALL be stored in object storage located in an India cloud region with server-side
encryption at rest, SHALL NOT be stored on the application server filesystem, and SHALL NOT be
readable without a signed URL. Storage buckets SHALL NOT permit public or anonymous read.

#### Scenario: Direct object access without a signature

- **WHEN** an object's storage path is requested without a valid signature
- **THEN** the storage layer refuses the request

#### Scenario: Signed URL expiry

- **WHEN** a signed URL is issued for a document
- **THEN** it is valid for no more than 15 minutes, is scoped to that single object, and its issuance
  is audit-logged with the requesting actor

#### Scenario: Access is authorization-checked before a URL is issued

- **WHEN** a doctor who is not assigned to the case requests a document URL
- **THEN** no URL is issued, the request is refused, and the denial is audit-logged

### Requirement: Patient-supplied classification survives extraction failure

The patient SHALL be able to tag each upload with a rough document type and an approximate date, and
these tags SHALL be retained regardless of whether automated extraction succeeds.

#### Scenario: Unreadable scan

- **WHEN** extraction fails on a poor-quality scan
- **THEN** the document remains attached with the patient's own type and date tags, is marked as not
  machine-readable, and is presented to the doctor with the original for manual reading

### Requirement: Extraction produces a labelled, unverified summary

The system SHALL attempt text extraction — direct for native PDFs and DOCX, optical character
recognition for scans and images — and SHALL then produce a structured extract naming the report type,
its date, key findings, and any values flagged as outside their reference range. The extract SHALL be
labelled AI-generated and unverified until a doctor confirms it, and the original file SHALL remain
the source of truth.

#### Scenario: Extract is shown as unverified

- **WHEN** a doctor opens a document with an automated extract
- **THEN** the extract is displayed marked as AI-generated and unverified, alongside a link to the
  original, and the doctor can mark it confirmed or corrected

#### Scenario: Extract never replaces the original

- **WHEN** a document has been extracted
- **THEN** the original file is retained unmodified and remains retrievable

#### Scenario: Extraction is consent-gated

- **WHEN** a document is uploaded to a case whose patient has not granted `ai_assisted_analysis`
- **THEN** the file is stored and attached but no content is sent to any model or OCR provider outside
  the platform's own trust boundary, and the document is presented to the doctor unextracted

### Requirement: Uploads are attached to a case and audit-logged

Every document SHALL be attached to exactly one case, and every upload, view, extract, and deletion
SHALL be audit-logged with actor, action, target document, and timestamp.

#### Scenario: Patient deletes an upload before submission

- **WHEN** a patient deletes an uploaded document from an `in_progress` case
- **THEN** the object is removed from storage, the attachment is removed from the case, and the
  deletion is audit-logged

#### Scenario: Deletion after submission

- **WHEN** a patient attempts to delete a document from a case that has been submitted
- **THEN** the deletion is refused as a clinical-record change and routed to the data-subject-rights
  correction process instead
