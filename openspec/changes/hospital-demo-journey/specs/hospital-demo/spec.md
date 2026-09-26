## ADDED Requirements

### Requirement: Manageable intake and honest topic progress
The system SHALL present a main intake in named topics, retain all rule inputs and dependencies on that route, and offer remaining active questions as optional detail. Skipping SHALL leave answers unknown and SHALL NOT lower urgency already established by active answers. Progress SHALL distinguish answered from incomplete topics. Saved resume SHALL restore the topic and main/optional mode without repeating completed work.

#### Scenario: Optional detail does not become another mandatory questionnaire
- **GIVEN** the DRAFT main intake has been answered
- **WHEN** the patient proceeds to review or chooses one optional topic
- **THEN** they can submit without optional detail, or return to review after that chosen topic; missing detail is explicit and Important advice persists

#### Scenario: Resume and changed dependencies
- **GIVEN** a patient saves halfway through a named topic
- **WHEN** they reload or change an earlier answer
- **THEN** their saved topic is restored when relevant, active follow-ups update, and earlier hidden values remain labelled rather than treated as current evidence

### Requirement: Actionable clinician assessment validation
The system SHALL accept nonempty short clinical impressions and patient plans, reject whitespace-only values with field-specific feedback, preserve drafts on error, and keep client/server/database rules consistent. Historical saved drafts SHALL gain defaults for missing metadata without changing authored text. Saving SHALL retain access control, consent, source-version and deterministic urgency checks.

#### Scenario: Short clinical term
- **GIVEN** a synthetic consented encounter and a complete authorised review with a short clinical impression
- **WHEN** the clinician saves their independent assessment
- **THEN** it saves successfully and the interface confirms success without releasing a patient plan

#### Scenario: Missing assessment field
- **GIVEN** an impression or plan is blank or whitespace-only
- **WHEN** the clinician selects Save independent assessment
- **THEN** the relevant field shows a clear error and receives focus, and the entered draft remains available

### Requirement: Complete synthetic encounter journey
The application SHALL support consented intake, optional reports, preliminary AI assessment and a separate clinician review for fictional adult test encounters. It SHALL retain fixture provenance and DRAFT content metadata, and SHALL NOT imply validated clinical performance. Normal product screens SHALL use clinical workflow wording without repeated demonstration disclaimers.

#### Scenario: Intake without a report
- **GIVEN** a staff-created synthetic encounter with an assigned clinician
- **WHEN** the patient consents, answers questions and submits without a report
- **THEN** the answers persist, a durable AI job is queued and the encounter remains in the clinician worklist.

#### Scenario: Consent and unknown answers
- **GIVEN** no consent or an incomplete DRAFT questionnaire
- **WHEN** the patient leaves or selects not sure/declined
- **THEN** pre-consent clinical values are not stored, consented partial work remains assigned, and unknown answers are never converted to negative findings.

### Requirement: Independent immediate-care advice
Versioned DRAFT rules SHALL evaluate universally reachable facts without AI and SHALL explain matched rules. All clinical parameter provenance SHALL be recorded.

#### Scenario: Jaundice entry with acute danger facts
- **GIVEN** a DRAFT encounter entered through jaundice
- **WHEN** linked DRAFT questions record current fever/chills, yellow eyes and upper-right abdominal pain occurring in the same episode
- **THEN** immediate-care advice appears without waiting for optional reports, model execution or clinician sign-in, with no emergency calling or dispatch feature.

#### Scenario: Lower urgency and unavailable AI
- **GIVEN** a deterministic immediate-care floor
- **WHEN** AI proposes routine review or is unavailable
- **THEN** immediate-care advice persists in intake, submission and patient output; the case is never closed by the system.

### Requirement: Audited encounter isolation
Every clinical read/write SHALL pass through fixed audited RPCs with site/role or expiring encounter capability authorization and RLS. Shared-tablet handoff SHALL remove staff access before patient entry.

#### Scenario: Cross-site and cross-patient denial
- **GIVEN** staff from another site or a capability for another encounter
- **WHEN** they request this encounter, its original report or assessment
- **THEN** no clinical data is returned and a denied audit event is committed.

#### Scenario: Tablet reset
- **GIVEN** an active patient capability
- **WHEN** staff resets or rotates the handoff, or the patient ends the session
- **THEN** the previous capability no longer reads or changes the encounter and browser clinical state is cleared.

### Requirement: Optional source-linked reports
The patient SHALL be able to upload bounded PDF/photo reports. Extraction SHALL retain page/source provenance and verification state. Completed non-rejected machine-extracted proposals SHALL enter the preliminary AI snapshot automatically, explicitly labelled as not reviewed by staff. Unconfirmed manual findings and rejected findings SHALL NOT enter the clinical snapshot. This owner-authorised policy supersedes the earlier staff-verification prerequisite.

#### Scenario: Full-body laboratory report
- **GIVEN** the supplied synthetic full-body PDF
- **WHEN** it is uploaded and model extraction completes
- **THEN** its written findings, units, dates and source pages inform preliminary AI automatically, remain labelled unreviewed, and appear alongside the original for optional clinician correction.

#### Scenario: Unreadable scan
- **GIVEN** a scan with no extractable text or insufficient image quality
- **WHEN** extraction fails
- **THEN** the system honestly requests a clearer image or manual verification, retains no invented findings, and still allows submission without report findings.

### Requirement: Durable and transparent AI analysis
Only the configured LLM gateway SHALL perform model calls, using the selected local, Gemini or compatible adapter within existing environment restrictions. Leased jobs SHALL preserve version/consent, bounded retries and failure states. Outputs SHALL have source-linked factual reasoning, no likelihoods, no confirmed diagnosis, explicit uncertainty and consideration of abdominal TB. Patient output SHALL distinguish preliminary AI from clinician review.

#### Scenario: Stale or duplicate worker result
- **GIVEN** an expired lease, changed source snapshot or withdrawn consent
- **WHEN** a worker completes a previous job
- **THEN** that result does not publish as the current assessment and a duplicate cannot create a second release.

#### Scenario: Unsupported output
- **GIVEN** model text with unsupported evidence, reassurance, prescribing or malformed structure
- **WHEN** output validation runs
- **THEN** the patient sees an unavailable assessment and appropriate rule-based advice, never a fabricated fallback diagnosis.

### Requirement: Independent clinician comparison and release
Clinicians SHALL save their independent assessment before revealing AI in the workspace. Prior exposure SHALL be recorded. Comparison SHALL use saved fields. Only a clinician SHALL release a separate patient-facing assessment; private notes SHALL remain private.

#### Scenario: Clinician disagrees
- **GIVEN** an independent saved DRAFT clinician assessment
- **WHEN** the clinician reveals AI, records a different specialty/impression with a reason and releases
- **THEN** both assessments and their sources remain distinguishable, the patient receives only the released plan, and actual agreement/disagreement is shown without a clinical-accuracy claim.

### Requirement: Responsive demonstration and rehearsal
The journey SHALL be operable on desktop, tablet and phone using the supplied wireframes. A preflight and rehearsal guide SHALL identify required services and distinguish live versus prepared examples.

#### Scenario: Live demo readiness
- **GIVEN** the local app, worker, model and approved Cloud project are reachable
- **WHEN** the operator runs the rehearsal
- **THEN** a synthetic intake including a report reaches actual AI completion, clinician comparison and patient release with no foundation-placeholder dead end.

### Requirement: Public patient entry and wireframe states
Patients SHALL be able to start an assigned encounter at a clinic-specific URL without a mandatory account. Staff authentication SHALL remain separate. The server SHALL enforce consent, bounded creation rate and encounter-only access. Questionnaire screens SHALL present one question at a time with accessible large controls. Urgent advice SHALL remain visible in an Important banner without interrupting intake, and pause SHALL offer resume or device-session completion.

#### Scenario: Public entry has an assigned reviewer
- **GIVEN** an enabled clinic with an active reviewer
- **WHEN** a visitor starts at its public entry URL
- **THEN** an expiring HttpOnly encounter capability is created with no staff Auth session or clinical answers before consent.

### Requirement: Contextual linked questionnaire
The DRAFT questionnaire SHALL distinguish current symptoms, resolved symptoms and recurring episodes using contextual options and conditional detail across every inventory domain. Every question SHALL support unknown, declined and optional detail. Pain SHALL capture onset, current and worst severity, frequency, episode length, pattern, location, function and relieving/aggravating factors. Quantitative descriptions SHALL request units, time and measured/estimated provenance.

The DRAFT tier set SHALL remain `review` (arrange clinician review), `prompt` (contact a clinician promptly) and `immediate` (seek assistance now). No matched rule SHALL mean only that the questionnaire has not established a higher floor, never that serious disease is absent. Unanswered SHALL remain not-yet-answered, distinct from unknown/declined; skipped branches SHALL remain not-applicable-to-current-answers, not negative findings. Missing overlap with positive component symptoms SHALL retain at least `prompt`. Source facts SHALL identify reporter and enterer. All rule populations are adults and every clinical parameter SHALL carry version, source/adaptation, unknown handling and DRAFT provenance.

#### Scenario: Bleeding characterization
- **GIVEN** DRAFT fresh blood, coffee-ground vomit, tar-like stool or rectal bleeding
- **WHEN** linked answers establish active haematemesis, current/today tar-like stool, heavy current/today rectal bleeding or bleeding with illness in the same recent episode
- **THEN** the corresponding immediate rule matches; stopped historical bleeding and unknown timing retain prompt assessment, with retching, appearance, amount and frequency recorded separately.

#### Scenario: Fluids and swallowing
- **GIVEN** DRAFT inability to keep small sips down or difficulty swallowing
- **WHEN** linked answers establish very little/no urine with fluid intolerance or inability to swallow saliva now
- **THEN** immediate advice is shown; incomplete or other difficulty retains prompt review and no serious disease is excluded.

#### Scenario: Missing and conflicting information
- **GIVEN** DRAFT unanswered fields, unknown/declined values, or a source-linked verified report conflicting with patient answers
- **WHEN** intake is submitted or AI receives the source facts
- **THEN** unanswered, uncertain, inactive and conflicting sources remain distinguishable, values are never silently overwritten, absent TB evidence is unknown, and the case remains assigned for human review even when AI is unavailable.

#### Scenario: Recurring pain over months
- **GIVEN** DRAFT pain that comes and goes, started months ago and is absent between episodes now
- **WHEN** frequency, episode length, worst severity and what helps are supplied
- **THEN** those facts persist without interpreting historical severity as current severe pain, and the patient continues to other symptoms.

#### Scenario: Current severe pain
- **GIVEN** DRAFT answers establishing pain is present now
- **WHEN** its current severity is severe or unbearable
- **THEN** immediate advice appears without waiting for other symptoms, AI, a save or the next screen; the question and navigation remain available.

#### Scenario: Fainting and confusion are clarified
- **GIVEN** DRAFT fainting with full recovery or lightheadedness without loss of consciousness
- **WHEN** timing and recovery are answered
- **THEN** that broad symptom alone does not establish current collapse; new sudden confusion or current incomplete recovery retains immediate advice after linked answers.

#### Scenario: Linked symptoms must overlap
- **GIVEN** DRAFT swelling, vomiting and inability to pass gas/stool, or jaundice, fever/chills and upper-right pain
- **WHEN** these occurred in different episodes, or overlap is unknown/declined
- **THEN** the same-episode immediate rule does not match, uncertainty stays explicit and conservative review advice persists.

#### Scenario: Edited and hidden answers
- **GIVEN** a DRAFT follow-up answered under a positive parent
- **WHEN** the parent becomes negative, unknown or declined
- **THEN** the earlier detail remains identifiable but cannot silently contribute an active danger match or current AI fact.

#### Scenario: Banner never blocks
- **GIVEN** a matched DRAFT immediate rule and unavailable or lower-urgency AI
- **WHEN** the patient continues, goes Back, pauses, adds reports, reviews or submits
- **THEN** Important advice persists, no acknowledgement is required, and seeking assistance is explicitly independent of completing intake.

#### Scenario: Historical versions
- **GIVEN** a saved encounter or queued job with the previous content version
- **WHEN** revised content is deployed
- **THEN** original options, facts and rules remain pinned and supported; new encounters use revised content, browser/database validation agree and AI cannot lower either floor.

### Requirement: Multimodal report processing and staff ownership
The report worker SHALL use structured model extraction from native text or rendered pages/photos. Proposed findings SHALL include source text, page, report type/date and extraction provenance, and SHALL remain explicitly unreviewed until optionally reviewed. Non-rejected machine extractions SHALL inform preliminary AI without mandatory staff verification. Manual findings SHALL require explicit staff confirmation; corrections/rejections SHALL retain provenance, source-version guards and append-only history. Exhausted or failed jobs SHALL retain an honest incomplete-assessment and human-review path.

#### Scenario: Automatic report evidence
- **GIVEN** a consented encounter with a readable laboratory, ultrasound, CT, MRI, endoscopy, pathology or other written report
- **WHEN** extraction completes with source-grounded findings
- **THEN** preliminary AI can use the relevant findings without staff action, with type/date/page/source and machine-extracted unreviewed status preserved; no radiology-pixel interpretation or inferred missing result is allowed.

#### Scenario: Submission before extraction completes
- **GIVEN** submitted intake and one or more queued/running reports
- **WHEN** report processing reaches terminal states
- **THEN** claim assessment only after pending reports finish, freeze current report metadata/findings/statuses, automatically replace stale queued/running jobs and reject late publication for an older source version.

#### Scenario: Report failure and corrections
- **GIVEN** failed, empty, rejected or manually corrected report findings
- **WHEN** the assessment is generated
- **THEN** unavailable findings stay unknown; rejected and unconfirmed manual entries are excluded, confirmed corrections are attributed to staff, and failed processing never blocks human care or silently changes a released plan.

#### Scenario: Readable PDF with vision available
- **GIVEN** a PDF page with readable embedded text and a processor that supports vision
- **WHEN** extraction runs
- **THEN** use the text path, verify proposed source quotes against that text and leave all findings unverified; use image reading for pages without sufficient text.

#### Scenario: Visible processing failure and bounded recovery
- **GIVEN** extraction failed or its running lease expired
- **WHEN** a member of staff views the saved report
- **THEN** show the failure or interruption, a safe reason, and original-review access; permit an audited retry only with current consent, no released plan, no verified report and no saved findings; invalidate the old lease and preserve clinician drafts.

#### Scenario: Page progress and empty extraction
- **GIVEN** a multi-page report
- **WHEN** pages finish processing
- **THEN** show numeric page progress without exposing report text through processing metadata; a completed extraction with no findings is explicitly labeled as such.

#### Scenario: Unchanged verification preserves assessment work
- **GIVEN** a clinician draft and an unchanged report, including a report with no findings
- **WHEN** staff save identical report fields against the current source version
- **THEN** record the authorized action without changing evidence, source version or draft, and without scheduling assessment; verification remains unavailable during queued or running extraction.

#### Scenario: Slow report processing
- **GIVEN** a report whose extraction exceeds the initial lease duration
- **WHEN** the worker renews its lease and finishes
- **THEN** current consent and lease are rechecked before unverified proposals publish; lost leases or withdrawn consent cannot publish.

#### Scenario: Report updates preserve in-progress clinician work
- **GIVEN** an independent assessment form with saved or unsaved entries
- **WHEN** report progress, retry or unchanged verification returns the same source version
- **THEN** preserve form text, dirty state and the version the clinician reviewed.
- **AND** background source changes or changed verification with unsaved edits retain the text and block stale signing; only an explicit local evidence change without unsaved edits may reset the old assessment, with the current deterministic urgency floor.

### Requirement: Structured clinician output and feedback
Clinician plans SHALL persist investigations, follow-up and urgency explanation. Release SHALL have an explicit server-confirmed completion state. Optional AI feedback SHALL record overall and per-dimension judgments separately from the released plan without favorable defaults.

#### Scenario: Optional feedback after release
- **GIVEN** independently saved clinician assessment, released patient plan and revealed AI
- **WHEN** the clinician submits dimension-level feedback
- **THEN** an immutable evaluation records the assessment versions and prior exposure without modifying the plan.
