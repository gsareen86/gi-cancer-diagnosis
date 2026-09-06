# GI Compass implementation plan

Date: 6 September 2026  
Status: Proposed implementation programme; application code unchanged  
Planning change: `openspec/changes/enable-early-gi-care-journey`

## 1. Product objective and boundaries

Help a person with persistent GI symptoms understand the need for appropriate assessment, prepare a useful history, and follow the next step through. Help a busy clinician understand that history quickly and respond without reconstructing it or completing eight blank essays.

The first journey must work with no reports. A second, optional journey accepts existing reports. Neither reports nor symptom duration establish cancer or its stage. The app is intended to support earlier appropriate assessment; reduced diagnostic delay and earlier cancer diagnosis remain outcomes to demonstrate.

The emergency experience is advice-only: prominent, clinically approved immediate-care advice that persists after acknowledgement and submission and explains not to wait for an app review. There are no call buttons, SOS dispatches or emergency-contact notifications.

Retain the existing web application, role boundaries, clinical-history collection, image/body-map components, review workspace, consent and audit foundations. Repair and connect them rather than rebuild the application.

## 2. Delivery assumptions

- V1 planning scope is adults aged 18 or older. Pediatric clinical logic is outside this release; provide general help/access guidance without claiming an adult assessment applies. The age boundary is a scope assumption for clinical review, not a cancer-risk threshold.
- Your relative is the clinical owner and a possible reviewer. No coordinator or additional clinician is assumed.
- Clinical review will use short asynchronous batches: question/rule rationale, sample journeys, wording and discrepancies. Effort is recorded from the first batch; do not invent an available weekly time commitment.
- Begin with English and clinically approved Hindi. Unapproved translations stay unavailable with honest language labels.
- Use a responsive web journey accessible from trusted links. Mobile OTP and paid messaging integration are deferred by the user. Retain existing email/password authentication and recovery; do not advertise phone login.
- No real clinic pilot or observation is a prerequisite for writing or implementing the technical programme. Until clinical content is approved, testing uses synthetic data and the personalized clinical flow remains unavailable to the public.
- The clinical service must specify who owns accepted cases, when reviews occur and what happens during absence. If these are unconfigured, the app offers history preparation without promising specialist review.
- Work estimates below are engineering planning estimates, not research findings or evidence of adoption.

## 3. The completed user journeys

### Patient or caregiver

1. Choose language and identify whether completing for oneself or someone else.
2. See immediate-care guidance and complete a short, approved safety assessment. It must not depend on OTP delivery, upload or AI availability.
3. Authenticate and consent before storing an identified clinical record or sharing it. Preliminary answers, if collected before authentication, remain in volatile device memory without analytics and are explicitly confirmed when attached to a case.
4. Capture the main problem, onset, progression, functional effect, previous remedies/medications, prior consultations and relevant history.
5. Answer focused follow-ups. Use text plus approved visual aids; allow uncertainty and corrections.
6. Optionally upload existing reports. Poor or missing files do not block consultation access.
7. Review an editable factual summary. Corrections may legitimately change downstream questions.
8. Submit only to an available, configured service or export a clearly labelled patient-prepared history. Show the actual receipt, service availability and next action.
9. Respond to specific information requests and record progress, barriers or changed symptoms.

### Clinician

1. Open a mobile-friendly queue that shows priority, ownership, review state, information requests and service deadlines accurately.
2. Open a case without starting a review or notifying the patient.
3. Read a short brief: trajectory, explicit concerning findings, relevant history, treatment tried, existing evidence, uncertainty and the decision needed.
4. Inspect the original answers/report page where necessary. Start review explicitly.
5. Choose a next action, request clarification, or draft advice. Optional AI assists with source-bound organization; manual work remains available.
6. Save automatically, review the final patient text, finalize and explicitly release an immutable version.
7. See whether the message was delivered and what follow-through remains outstanding.

## 4. Phases, dependencies and acceptance gates

Engineering effort is measured in engineer-weeks, not elapsed sprint weeks. Shared work is counted once.

| Phase | Deliverable | Effort estimate | Main dependency |
|---|---|---:|---|
| 0 | Baseline, scope and clinical scenario pack | 0.5–1 | None |
| 1 | Safety, complete facts and durable job foundation | 3–4 | Phase 0 |
| 2 | Symptom-first patient/caregiver intake | 3–4 | Phase 1 contracts |
| 3 | Clinician brief and recoverable review | 3–4 | Phase 1; iterate alongside Phase 2 |
| 4 | Clinical authoring and service operations | 3–5 | Job/data contracts; before external use |
| 5 | Follow-through and distribution instrumentation | 2–3 | Phases 2–4 |
| 6 | Integrated verification and readiness decision | 2–3 | All required capabilities |

Total: approximately 17–24 engineer-weeks before contingency, vendor onboarding delays or clinical review delays. One experienced full-time engineer should provision roughly four to six months of engineering effort. Two complementary engineers may shorten elapsed time, but the work and clinical dependencies do not divide evenly. Re-estimate after Phase 0 and after the first complete synthetic journey.

### Phase 0 — Establish a trustworthy baseline

Deliver:

- Record commit, dirty working-tree inventory, runtime configuration names (never secrets), existing test/build results and which behavior is actually verified.
- Reconcile existing pending OpenSpec changes. Explicitly replace calling, acknowledgement-as-closure and mount-triggered review assumptions; retain the approved Navigator layout and deliberate AI-draft adoption.
- Create an initial clinician-reviewable scenario pack covering persistent symptoms without reports, acute concerning patterns, benign alternatives, uncertainty, caregiver disagreement and access barriers.
- Define the public product claims, adult scope, clinical owner, service availability and source/licensing register.
- Define example patient and doctor screens using fictional data, including the no-report brief and advice-only urgent screen.

Acceptance:

- Every accepted product decision maps to a requirement/task.
- Each clinical threshold or rule has an owner and approval status; none is presented as validated because it exists in seed code.
- No pre-existing user changes are overwritten or silently counted as new work.

### Phase 1 — Repair safety and information integrity

Deliver:

- A safety-question scheduler that collects required facts independently of the selected symptom entry and reveals relevant follow-ups based on real answers.
- Tri-state clinical facts: affirmed, explicitly denied, unknown/not established. Preserve why data are unknown.
- Complete history in the deterministic compiler and optional AI input: medicines, allergies, conditions, surgery, family history and measurement provenance.
- Source and version references on factual statements; distinguish patient report, caregiver report, uploaded source and clinician confirmation.
- Separate factual medicine history from AI treatment recommendations in the output contract and validation.
- Persistent urgent advice, repeat-advisory deduplication, re-escalation on new/worsening facts and no false reassurance on an incomplete screen.
- A durable jobs/outbox foundation for AI work and service notifications, with restart-safe execution and visible failure.

Acceptance:

- Reproduce the nonbloody-vomiting/fluid-retention/dehydration counterexample as a failing test before changing the engine.
- Run actual patient-answer sequences across all five entry points, including negative answers and changed branches.
- Advice works with AI unavailable and is displayed locally if answer persistence fails; the UI honestly marks what was not saved.
- No unverified extract can silently answer a safety question.
- The no-report brief renders without a model and never converts omitted history into a negative.

### Phase 2 — Make patient intake usable

Deliver:

- Retain existing email authentication and recovery. Defer mobile OTP/provider integration; preserve the future separation of account holder and patient subject.
- Separate account holder, patient and caregiver authorization; a family relationship or shared phone is not sufficient authorization.
- A short shared safety stage followed by focused symptom/history stages. Clinical review determines content; five or nine graph-unlocking questions are not treated as a validated screen.
- Duration, progression, earlier episodes, response to remedies, prior consultations and practical effect on eating/daily activity.
- Optional report upload, quality feedback and manual document use when extraction fails.
- Approved images with visible text alternatives; stable stage progress; plausible measurements with confirmation rather than invented corrections.
- Draft resumption after authentication, edit-before-submit and versioned amendments after submission.

Acceptance:

- A fictional patient completes the full journey using existing authentication and without reports.
- A caregiver can help an authorized patient without merging household identities.
- Authentication or email-delivery failure does not hide urgent advice or claim the case was submitted.
- Mobile, keyboard and low-bandwidth journeys remain usable; unknown answers do not become reassuring negatives.
- Unapproved Hindi text is not silently published.

### Phase 3 — Make the clinician's work concise and recoverable

Deliver:

- Source-linked executive brief and one-click access to original answers/report pages within the current Navigator.
- Explicit review start; correct in-review/awaiting-information counts; mobile queue cards and compact filters.
- Server autosave with visible saved/saving/failed states, session refresh and stale-write conflict detection.
- Structured next-action choices with optional free text; small, clinician-curated neutral templates and explicit preview/apply.
- Request-information threads with authorized replies and post-submission uploads.
- A review snapshot containing clinician identity/registration, patient identity, date, approved advice and the precise sources reviewed.
- An immutable released PDF; private notes and raw AI output remain excluded.

Acceptance:

- Opening five cases sends zero review-start notifications.
- Refresh, navigation, session renewal and conflicting tabs do not silently discard or overwrite drafts.
- New patient information marks the brief/draft as stale and requires review before release.
- A requested missing report can be added without modifying the historical released letter.
- Scripted clinician tasks are timed; a 30-second brief and approximately three-minute simple disposition are design targets, not observed clinical results.

### Phase 4 — Make content and service operation dependable

Deliver:

- Clinical admin can draft, preview, review and publish questions, rules, image associations and approved language text without editing TypeScript.
- Versioned scenario results, rationale and reviewer identity are required for publication; affected in-progress cases retain pinned versions.
- A small licensed/permission-checked guidance set and ingestion process. Optional AI recommendations are disabled when suitable approved guidance is unavailable; factual briefs remain available.
- Production storage and real malware/file inspection; authenticated document viewing, bounded extraction and source verification.
- Configured availability/capacity and assignment, explicit handover, retryable delivery and operator visibility into unowned/overdue cases.
- Privacy request fulfillment with identity checks, export, assessed deletion/retention exceptions, audit, backup and recovery procedures.
- Operational review deadlines separate from clinical urgency. No emergency-tier waiting period implies it is safe to wait for a review.

Acceptance:

- Overdue work and failed deliveries are detected with every browser closed.
- Worker interruption and duplicate delivery do not duplicate clinical releases or patient reminders.
- An unavailable surgeon is not assigned new work automatically; no recipient is invented for escalation.
- Admin publication rejects missing clinical approval, failed safety scenarios and unavailable language assets.
- Storage, access-control, backup restoration and privacy workflows have runnable evidence, not only documentation.

### Phase 5 — Track whether the next step happened

Deliver:

- Care actions with an owner, due/review time, state and source: recommended, patient-reported arranged/completed, clinician-verified where appropriate.
- Patient states such as unable to arrange, cost/travel concern, declined and needs clarification.
- Configurable, consented reminders using nonclinical notification text and authenticated links; bounded retries and opt-out.
- Named responsibility for reviewing requested results; uploading a file does not mean a clinician reviewed it.
- Reassessment of newly reported symptoms and versioned follow-up history.
- Distribution-source instrumentation from trusted links before specialist booking, without advertising trackers or symptom data in analytics.

Acceptance:

- Reading the summary records acknowledgement only.
- Missed actions remain visible; closure includes a reason and does not claim care was completed without evidence.
- Referral destination and urgency are independent of funder and acquisition source.
- Staff-assisted work is offered only if an actual staffed service exists.

### Phase 6 — Verify the complete service

Deliver:

- End-to-end synthetic journeys for no-report patients, caregiver access, clarification, amendments, manual review, release and follow-through.
- Clinical-content review and bilingual comprehension review conducted remotely/asynchronously where available.
- Security and operational fault injection: expired sessions, wrong-case access, worker death, provider timeouts, duplicate webhooks, delayed OCR and restore from backup.
- An evidence pack separating developer tests, clinician-reviewed simulations, remote usability observations and unmeasured real-world outcomes.
- A release decision and rollback runbook.

Acceptance:

- No unresolved critical safety-path or access-control defect in the defined corpus.
- Every safety recommendation uses an approved content/rule version; all known failures have regression cases.
- No claim of clinical sensitivity, adoption, willingness to pay or earlier stage at diagnosis is derived from these tests.
- Public personalized clinical functionality stays disabled if clinical governance, content approval or actual review capacity is incomplete. The preparation/demo mode can still be evaluated.

## 5. Work allocation

| Responsibility | Accountable role | Evidence |
|---|---|---|
| Scope, distribution and user priorities | Product owner | Decisions and task acceptance |
| Clinical questions, wording, thresholds, service routing | Clinical owner/RMP | Versioned review and approval |
| Data contracts, APIs, migrations, jobs and security | Engineering | Automated and integration evidence |
| Mobile interaction, language comprehension and usability | Design/usability support; engineering where necessary | Scripted task observations and corrections |
| Privacy applicability, hosting/vendor terms, content rights | Designated privacy/legal reviewer | Dated applicability and permission records |
| Accepted cases, absence, delivery failures and results | Named service owner | Roster, operating instructions and fault drills |

One person may perform several roles, but no role is treated as staffed merely because its screen exists. Clinical approval cannot be assigned to a language model.

## 6. Offline evaluation and metrics

Start with approximately 40 deliberately diverse fictional base cases as a planning workload, then add failures and clinically requested variations. For applicable cases, run across all five entry points and both approved locales. This is a regression corpus, not a sample from which clinical sensitivity is estimated.

Include: black stool with fainting; nonbloody vomiting with reduced urine; jaundice with fever and pain; isolated/progressive swallowing symptoms; bleeding without weight loss; persistent discomfort with temporary medicine relief; no reports; uncertain weight change; conflicting caregiver and patient histories; changed answers; unreadable/wrong-patient reports; repeated uploads; clinician absence; incomplete submission; consent withdrawal; new symptoms after release.

Measure:

- Patient task completion, elapsed time excluding interruption, misunderstood questions, backtracking and help requests.
- Doctor active interaction time versus model/network waiting; omitted or incorrect facts, source-checking effort and corrected drafts.
- Extraction field accuracy by document class, units/date attribution and unsupported values; uncertainty/abstention is measured separately.
- Service delivery retries, unassigned accepted cases, missed job execution and unresolved information requests.
- Later, with appropriate real-use evidence: assessment attendance, outstanding-result resolution, continued clinician use and willingness to pay.

Initial engineering targets: deterministic evaluation meets the existing 100 ms p99 core budget on a documented synthetic workload; saved drafts persist within two seconds after typing pauses under normal test conditions; model work never blocks manual review. Record hardware/network/load and distinguish core evaluation from end-to-end latency. These are acceptance targets, not clinical benchmarks.

## 7. Economics and distribution

Do not assume a hospital will pay per intake or that patients will pay a specific fee. Record real costs: messaging attempts, inference/OCR, storage, service operation and human handling minutes. Report clinician time and any coordinator time separately; moving work between people is not automatically a saving.

Cost per completed preparation/review episode = allocated fixed operating cost + variable infrastructure/message cost + actual human handling cost. Keep preparation-only and clinician-reviewed episodes separate.

Start distribution evaluation with access before specialist booking: existing educational material, clinic enquiries or consenting referring clinicians. Do not use Metro/Apollo branding, endorsement or a fast-track appointment promise without actual permission and operational agreement. Routing must not change with the hospital that pays.

## 8. First implementation slice

The first slice should reproduce and repair the dehydration path, establish the safety follow-up contract, preserve unknown history, connect the full history to the deterministic brief, and show persistent advice-only urgency. Include a source-linked fictional no-report case and an AI-unavailable test.

Then add explicit review start and server autosave. This gives an early reviewable patient-to-clinician slice while later identity, authoring, operations and follow-through work proceeds. It is a development milestone, not permission to release an unapproved clinical instrument.

## 9. Sources and planning validation

- [WHO early-diagnosis guide](https://www.who.int/publications/i/item/guide-to-cancer-early-diagnosis): supports addressing recognition, diagnostic/referral capacity and access together; it does not validate this app.
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html): technical reference for OTP, authentication lifecycle and session controls; not an India healthcare compliance certification.
- `docs/india-privacy.md`: existing dated applicability register; reverify against actual intended use/providers before external operation.
- Current code and the read-only synthetic patient-path probe from this review support the implementation priorities. Older third-party audit numbers and test counts are not used as release evidence.

The OpenSpec CLI was unavailable locally and in the offline npm cache on 6 September 2026. A structural document check can verify files, task syntax and scenario presence; it is not a substitute for official OpenSpec validation. No new dependency, production setting or application code was changed to produce this plan.
