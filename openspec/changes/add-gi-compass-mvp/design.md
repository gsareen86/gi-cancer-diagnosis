## Context

Greenfield build. See `proposal.md — Why` for motivation and `specs/**/spec.md` for the behaviour
contract. The constraints that actually shape the architecture are regulatory, not technical:

- The AI may only support a Registered Medical Practitioner (Telemedicine Practice Guidelines 2020),
  so *"doctor has released this"* must be a state the data model enforces, not a UI convention.
- Health data is sensitive personal data under the DPDP Act 2023, so consent must be a per-purpose,
  versioned, revocable object that gates processing at the point of data access.
- CDSCO software-as-a-medical-device exposure is lowest if Phase 1 runs as an internal clinical tool
  for affiliated doctors. The build therefore assumes a single-tenant, small-doctor-count deployment,
  but nothing in the schema forbids growing into multi-clinic.
- Patients are on Indian mobile networks. Payload size and progressive rendering are correctness
  concerns for a questionnaire that must be finished in one or two sittings.

Team assumption: small, TypeScript-fluent, with one Python-comfortable engineer for the AI service.

## Goals / Non-Goals

**Goals:**

- A questionnaire engine whose clinical behaviour lives entirely in data, so a clinical admin can
  change what is asked without a deploy, and so the same engine serves every disease pathway.
- Guardrails that are *structurally* impossible to bypass rather than merely unimplemented:
  the AI output type has no diagnosis field, emergency escalation cannot reach an LLM call,
  and consent/audit are enforced below the API surface.
- Reproducibility of any past assessment from stored version pins alone.
- A domain core that is unit-testable with no database, no network, and no framework, because the
  safety-critical logic is exactly the logic that must be exhaustively tested.

**Non-Goals:**

- Horizontal scale. Phase 1 targets tens of concurrent patients, not thousands; no sharding, no
  read replicas, no queue cluster.
- A generic rules DSL. Branching and red-flag conditions use one small, closed, JSON-encoded
  expression grammar — not a scripting language — so that rules are analysable (cycle detection,
  reachability) and safe to author from an admin UI.
- Offline-first. Autosave plus resume is the low-bandwidth answer; a local-first sync engine is not.

## Decisions

### D1. Monorepo with a framework-free domain core

`packages/core` holds the questionnaire evaluator, the red-flag evaluator, the consent policy, the
clinical-summary compiler, and the AI output schema as pure TypeScript over plain data. `apps/web`
and any future React Native client depend on it; it depends on nothing.

*Why:* the safety-critical logic is the part that most needs exhaustive, fast, deterministic tests.
Anything requiring a database or a running Next.js server to test will be tested less.
*Alternative rejected:* putting the evaluators in the Next.js route handlers — faster to write, but
the test suite then needs a server and the logic cannot be reused by the mobile client.

### D2. Next.js route handlers as the core API, not NestJS

**Deviation from the build brief's suggested stack (Section 8 offered NestJS or FastAPI).**

*Why:* the brief's own goal is a small team shipping a web MVP. A separate NestJS service adds a
third runtime, a second deployment, a duplicated auth/session layer, and a network hop between the
UI and its own API, in exchange for decorators and DI we can get from plain modules. Next.js route
handlers with a hand-rolled middleware chain give the same API-layer RBAC enforcement the specs
require, with the domain logic already isolated in `packages/core` (D1) so nothing is coupled to the
framework. If the API later outgrows this, `packages/core` moves to a standalone service unchanged.
*Trade-off accepted:* less structure imposed by the framework, so the middleware chain
(`authenticate → authorize → consent-gate → audit`) must be a deliberate, tested, non-optional
composition rather than something the framework guarantees. See D5.

### D3. A separate Python AI service, as the brief recommends

`services/ai` (FastAPI) owns embeddings, OCR, document parsing, retrieval, and the LLM call. The core
API calls it over HTTP inside the trust boundary.

*Why:* the brief is right that Python's document-parsing and embedding ecosystem is materially better,
and isolating the only component that talks to an external model provider makes the egress boundary
one auditable place. It also means the slow, retry-heavy work cannot block a request thread in the web
app.
*Alternative rejected:* calling the model provider directly from Node — fewer moving parts, but OCR
and PDF parsing in Node are markedly weaker, and the egress boundary would be spread across the app.

### D4. One PostgreSQL instance with `pgvector`

Structured clinical data and knowledge-base embeddings live in the same Postgres.

*Why:* one database to back up, encrypt, restrict to an India region, and reason about for DPDP. The
knowledge base is doctor-authored clinical guidance — hundreds to low thousands of chunks — which is
far below where a dedicated vector store earns its operational cost.
*Alternative rejected:* a managed vector DB — better at scale we do not have, worse for data residency
and for the "one place patient-adjacent data lives" story.

### D4a. Drizzle ORM, not Prisma

*Why:* three of this system's hard requirements are expressed in SQL that an ORM must not hide.
The audit table's append-only guarantee is a `REVOKE UPDATE, DELETE` on the application role; the
`ClinicalRepository` needs the audit write and the clinical write inside one explicit transaction
(D5); and knowledge-base retrieval is a `pgvector` nearest-neighbour query. Drizzle is a typed
query builder over real SQL, so all three live in the same migration and query files as everything
else rather than in an escape hatch beside a generated client. It also ships as plain TypeScript
with no engine binaries to download, which keeps migrations runnable in a restricted-network CI.
*Alternative rejected:* Prisma — better ergonomics for ordinary CRUD, but its generated client
pushes exactly the operations we care most about (grants, transactional audit, vector search) into
`$queryRaw`, where the type safety that motivated the ORM stops applying.

### D5. Consent and audit are enforced in the data-access layer

All patient clinical data is reached through a `ClinicalRepository` that takes an explicit
`AccessContext { actor, role, purpose, caseId }`. It refuses without an active consent for the stated
purpose, and writes the audit entry in the *same database transaction* as the data operation.

*Why:* the specs require that no caller can reach clinical data by skipping the check, and that a
failed audit write fails the operation it describes. Both are only true if the check and the log are
inside the transaction boundary, not in a middleware that a new endpoint can forget to apply. A route
handler that forgets the context cannot compile: `AccessContext` is a required argument.
*Alternative rejected:* middleware-only enforcement — one forgotten decorator silently disables it.

### D6. Branching and red-flag rules share one closed condition grammar

A condition is a JSON tree of `{all|any|not}` over leaf predicates
(`answered`, `equals`, `includes`, `gt`, `lt`, `between`, `duration_gte`, `age_gte`). No user-authored
code, no string evaluation.

*Why:* it is analysable. Publication can prove the branching graph is acyclic and that every rule
target is reachable, which the spec requires. It is also serialisable, diffable in the admin UI, and
safe to accept from an admin form. The same grammar serving both branching and red flags means one
evaluator, one test suite, one thing for the clinician to learn.
*Trade-off accepted:* some rules a clinician imagines will not be expressible and will need a grammar
extension. That is a feature — every extension gets reviewed rather than smuggled in as a script.

### D7. Red-flag evaluation is synchronous, in-process, and in the answer-write transaction

Persisting an answer and evaluating the full red-flag rule set happen in one request. No queue, no
service call, no model.

*Why:* the spec demands escalation within the answer response and correct behaviour while the AI
service is entirely down. In-process evaluation over an already-loaded answer set is sub-millisecond
work; anything asynchronous introduces a window in which a bleeding patient is told nothing.

### D8. The AI output schema is defined once, in `packages/core`, and mirrored into the model call

A single Zod schema is the source of truth. It generates the JSON Schema handed to the model as a
tool definition *and* validates the response. It uses a strict object (unknown keys rejected), and the
differential `condition` field is constrained to the current taxonomy's identifiers.

*Why:* the specs require that an undefined field like `final_diagnosis` cannot enter the record and
that a schema violation is a retry, not a patch. One strict schema on both ends makes both automatic:
the model is told the exact shape, and anything else is rejected rather than repaired.
*Implementation note:* validation failure paths must never fall back to "save what parsed". The
retry budget is bounded and exhaustion routes the case to the doctor with the assessment absent.

### D9. Template versions are immutable; cases pin the version they started on

Publishing a draft creates a new immutable `QuestionnaireTemplateVersion`. A `Case` stores its
version. The engine always evaluates against the case's pinned version.

*Why:* a patient half-way through an interview must not have the ground shift under answers already
given, and a doctor reading a case a year later must see the questions as they were asked. This also
makes the "reproduce any past assessment" requirement achievable, since the answer set alone is
meaningless without the questions that produced it.

### D10. Answers are stored as option identifiers, never display text

Responses store stable identifiers plus typed values; display text is resolved from the versioned
template through the i18n layer at render time.

*Why:* it is what makes mid-interview language switching safe, and it means a clinician correcting a
question's wording does not alter the meaning of answers already recorded.

### D11. Documents leave the app server immediately

Uploads stream to object storage after content-type inspection and AV scan; the app server never
persists them to disk. Access is always via a ≤15-minute signed URL issued only after an
authorization check, and every issuance is audit-logged.

*Why:* the spec forbids app-filesystem storage and public buckets. Issuing the URL *after* the authz
check (rather than issuing long-lived URLs) keeps the authorization decision on the server for every
single access rather than once per document.

### D12. i18n from the first commit, enforced by lint

`next-intl` with message catalogues; an ESLint rule fails the build on literal display text in
patient-facing components. Clinical strings (questions, options, consent, red-flag copy) live in the
content database with a per-language `clinician_approved` flag, not in the code catalogues.

*Why:* the spec requires that clinical translations are clinician-approved rather than machine
translated, which means they belong with the versioned clinical content, not with UI chrome. Splitting
them this way is the only way publication can refuse a language whose clinical text is unapproved.

### D13. Defaults taken for unresolved product decisions

Each is implemented as the safer option and marked in code with a greppable
`TODO(confirm): Decision <X>` comment:

| Decision | Default implemented | Marker location |
|---|---|---|
| A — patient sees raw AI output? | No. Doctor-released only; no endpoint exposes the assessment to a patient. | case read path, patient export |
| B — single vs multi doctor? | Schema supports many doctors with per-case assignment; no clinic/tenant layer yet. | case assignment |
| C — disease taxonomy | Seeded with the Phase 1 list; malignancy as one urgent-referral category. | taxonomy seed |
| D — cloud provider | S3-compatible + Postgres, provider-agnostic behind interfaces; India region asserted by config. | storage adapter, config |
| E — minors | Adults only; under-18 refused at case creation. | case creation guard |
| F — retention periods | Configuration with no default; the retention job alerts rather than deletes when unset. | retention config |
| G — data fiduciary | Single fiduciary placeholder in the privacy notice and consent policy metadata. | consent policy seed |

## Risks / Trade-offs

- **A model returns a plausible but wrong differential that a rushed doctor rubber-stamps.** → The
  review UI never pre-fills the doctor's released summary from the AI's `clinician_summary`;
  finalization is refused without doctor-authored content. Every override is captured as a diff so
  systematic AI error becomes visible in review rather than staying invisible.
- **Red-flag rules are under-inclusive and miss an emergency.** → Rules are clinician-authored and
  versioned, the preview mode exercises them, and the deterministic evaluator is covered by a table
  of case fixtures. This is a clinical-content risk, not a code risk, and the mitigation is that the
  clinician can change rules without an engineer. Residual risk is real and must be stated in the
  patient-facing copy: the questionnaire is not a substitute for seeking care.
- **Consent gating in the repository is bypassed by a raw query.** → The application database role's
  privileges are the backstop (audit table insert-only), and a lint rule forbids importing the raw
  database client or `packages/db/src/schema` outside `packages/db`. A test asserts every clinical route goes through the repository.
- **The condition grammar proves too limited for real GI triage.** → Extending it is a deliberate,
  reviewed change; the alternative (embedded scripting) trades a bounded inconvenience for an
  unbounded safety and analysability problem.
- **The AI service becomes a single point of failure.** → It is not on any critical path: red flags
  are in-process, submission succeeds without it, and its unavailability routes the case to the doctor
  marked "AI assessment unavailable".
- **Deviating from the brief's NestJS suggestion (D2) makes a later API extraction costly.** → Mitigated
  by D1: the domain lives in `packages/core`, so extraction moves handlers, not logic.
- **CDSCO classification could land higher than assumed.** → The Phase 1 internal-tool framing and the
  doctor-in-the-loop gate are the mitigations available in software; the actual mitigation is the legal
  opinion, which is a launch blocker recorded in the proposal's Impact section.

## Migration Plan

Greenfield, so "migration" is initial rollout:

1. Provision Postgres 16 with `pgvector` in an India region; create a restricted application role with
   `INSERT, SELECT` only on `audit_log_entry` and no `UPDATE`/`DELETE` (D5's backstop).
2. Apply the initial migration; seed the disease taxonomy, the consent policy document version,
   and a starter questionnaire template with red-flag rules, all marked draft.
3. Bring up `services/ai` with the model provider key held only there; verify the core app cannot reach
   the provider directly.
4. Create the first `platform_admin` out-of-band, then grant the clinical-admin and doctor roles.
5. The clinician reviews and publishes the seeded template through the preview mode before any patient
   account exists.
6. Rollback: the deployment is a single database plus two stateless services. Roll back by redeploying
   the prior image and, if the schema changed, applying the down migration. Published template versions
   are immutable, so a bad clinical change is rolled back by republishing the prior version — never by
   a code rollback.

## Open Questions

- Which OCR path — a managed Indian-region OCR service versus self-hosted Tesseract — is deferred until
  the accuracy of the first real report scans is known. It sits entirely behind one interface in
  `services/ai` and changes no spec, no schema, and no task boundary.
- Whether the doctor queue needs an explicit SLA timer is deferred until the clinician has used the
  dashboard on real cases; it adds a field and a sort, and changes nothing else.
