## Context

See `proposal.md` for the product reset. The inherited tree at `842cd47` contains
useful review/history/responsive work, but remains a patient-account-oriented app with
partly completed safety and operations changes. No main specs have been published.
The proposed clinic workflow needs its own access and encounter model; relabelling
the current app as a pilot would not supply that model.

The owner requests clean OpenSpec context before implementation. This change defines
one bounded first increment. It neither imports the old 88-task backlog nor marks it
complete. The complete v1 sequence remains in the roadmap, not in this change's tasks.

## Goals / Non-Goals

**Goals:** establish observable mode boundaries; provide a truthful current-purpose
entry and synthetic examples; define pure, testable pilot measurement contracts;
leave a short implementation handoff.

**Non-goals:** enabling patient records, changing published clinical content, implementing
encounter authorisation or telemetry storage in this increment. No provider provisioning,
paid API use, production deployment, legal certification or clinician approval.

## Decisions

### 1. Reuse the repository, reset the planning authority

Keep the existing source and migrations, with the earlier work checkpointed on its
original branch. Move obsolete pending changes to `docs/history/2026-09-13`, preserving
checkboxes and Git rename history. Use `openspec/config.yaml`, `START-HERE.md` and a short
root `AGENTS.md` to point future sessions at current decisions. Do not use the OpenSpec
archive command on incomplete changes; that would imply delivery and sync stale specs.

Alternative: delete/recreate the application or maintain all old backlogs as active.
Rejected: losing reusable engineering is expensive; retaining contradictory active
backlogs defeats the requested context hygiene. This is a product reset, not a database
reset. Existing migration numbers and stored records remain untouched by this change.

### 2. Introduce a server-enforced operating boundary before adapting real workflows

Define a strict shared operating contract with `local_demo`, `test`, and reserved
`pilot` modes. Read the server mode from environment once; missing means `local_demo`,
invalid values fail startup, and `test` requires `NODE_ENV=test`. `pilot` is deliberately
closed in this increment. Readiness evidence is descriptive; no boolean or environment
string can turn an unfinished application into an authorised pilot.

Add a central boundary to clinical route wrappers and explicit guards to clinical
server components. Inventory all inherited routes and services: cases/history/answers,
documents/downloads, summary/release, messaging, queues/reviews/metrics, AI assessment
and extraction. Gate before body parsing, storage reads, background dispatch or output.
Keep authentication and non-clinical public content separate. Apply the same mode
restriction to direct AI-service clinical endpoints so calling the internal service
cannot bypass the web boundary. A denied event uses the existing audit/security path
and records no request body; generic response details do not enumerate records.

Existing automated suites explicitly use isolated `test` mode and their guarded test
database. New boundary tests use the real default to prove local demonstration does
not inherit test privileges. Never accept a request header/query/body mode override.
Read-only public examples use an allowlist of fixture IDs, not clinical repositories.

Alternative: a banner or `PILOT_APPROVED=true`. Rejected: neither prevents old URLs,
server rendering or asynchronous processing from accessing records. This temporary
boundary will be extended by later approved encounter workflows; it is not a claim
that the entire real-data security model is implemented today.

### 3. Show the new purpose without pretending the pilot is implemented

Update the landing surface and current product description in translations. Offer
read-only, explicitly synthetic no-report and existing-report examples with separate
patient and clinician projections. Illustrative hypothesis text is fixture content,
not a claim that a live AI model ran. No free-text entry or user upload in this initial
example surface. Existing clinical workspaces are gated until their replacement
encounter flow is implemented; an authenticated user can receive the mode explanation
rather than an unguarded legacy page.

Use existing tokens/icons/localisation. At wide sizes show parallel narrative and
preview panels; at tablet/phone sizes stack in reading order. Clinical lead approval
still controls available clinical locales. Reference images remain honest placeholders
or currently approved assets; no new remote medical-image dependencies.

Alternative: build a disposable second frontend. Rejected: a responsive entry and
shared components in the existing app can remain useful through later increments.
The full application, report ingestion and clinician review remain committed v1 scope
in the roadmap; a read-only example is only this increment's reviewable surface.

### 4. Define measurement before wiring persistence

Add a small `packages/core` evaluation module with strict Zod contracts and pure
calculators. No DB, HTTP, clinical narrative or public submission endpoint. Use opaque
synthetic codes for this change. Contracts identify protocol/source/content/model
versions, independent-reference exposure, primary/acceptable routes, structured urgency
constraints and outcome dispositions. Require compatible snapshots before comparing.

Accounting has one primary disposition per eligible encounter, with a documented
precedence: withdrawn, invalid/incompatible versions, reference absent/exposed,
AI unavailable/abstained, inadequate information, then evaluable. Retain detailed
reason flags separately when more than one applies. Aggregates reconcile exactly.
Rates with no evaluable denominator return `null` plus a reason, never zero by default.

Represent observed work as explicit actor/activity sessions and ordered start/pause/
resume/end events. Validate unique event IDs and monotonic time; sum active spans;
reject same-actor overlap pending correction. Waiting is not clinician effort.
Comparison needs a declared compatible baseline/cohort. Return insufficient data
when that requirement is not met. The later telemetry change adds controlled storage,
independent-before-reveal interaction and restricted exports under consent/audit.

Alternative: count approval clicks and use case-open/case-close timestamps. Rejected:
they confound exposure with agreement and waiting/interruptions with human work.

### 5. Preserve infrastructure options while keeping actual decisions explicit

Retain Next.js, PostgreSQL/Drizzle and the Python service. Supabase in the pasted
recommendation is not an authorised migration or an installed integration requirement.
Local inference is the demonstration target for the later reasoning change. Pilot
Azure model/deployment selection is deferred to D04; standard/geography evidence is
checked then, not inferred from a hostname. No Global/DataZone fallback. Identity
minimisation is the default design, while document/free-text de-identification remains
a separate verifiable operation under D05.

## Risks / Trade-offs

- [The first increment gates inherited clinical screens] → Make the mode explanation
  explicit, preserve the old branch, and test the new synthetic entry end to end. Do
  not deploy this branch over an existing live service; no deployment is authorised.
- [A mode check is mistaken for complete security] → Keep access/consent/audit primitives;
  explicitly scope the guard to activation and block pilot mode until later evidence.
- [Pure metrics are mistaken for collected evidence] → Label fixtures synthetic and
  implement no live metric endpoint in this increment.
- [UI text suggests Metro endorsement or approved Hindi] → Do not use partner branding;
  gate language claims on actual publication status.
- [Clinical worksheet values become hard rules] → Keep it as draft documentation;
  clinical authoring/publication is a separate change with named approval and tests.
- [Historical defects propagate through reuse] → Run current typecheck and relevant
  baseline tests before implementation; record failures separately rather than carrying
  forward old pass counts. Broaden regression checks when boundaries affect old routes.

## Migration Plan

1. Preserve the old dirty state in checkpoint `842cd47`; create
   `codex/gi-specialty-navigation` from it. This was completed during planning.
2. Commit only the new planning/context reset and historical relocation in this turn.
3. In a fresh implementation session, run the apply workflow and baseline checks;
   implement the guard, entry and pure evaluation contracts with their acceptance tests.
4. Local synthetic verification only. No DB schema migration is needed for this change,
   no records are erased, and no cloud resources are created.
5. Rollback code with a normal reviewed revert or return to the preserved old branch;
   never reset/delete database volumes. Keep new planning history. Subsequent changes
   introduce additive migrations with their own rollback/compatibility plan.

## Open Questions

D01–D09 in `brief.md` remain explicit **pilot gates**, not defaults chosen on the owner's
behalf. Their answers do not change this increment because it enables no patient-data
pilot. In particular, retention, company details, Metro permission, Azure terms and
clinical sign-off cannot be filled by the implementation agent. Numerical agreement
and time-savings targets remain unset pending the clinical pilot protocol.
