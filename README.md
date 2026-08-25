# GI Compass

An AI-assisted gastrointestinal diagnostic-support platform for patients in India.

A patient answers a guided, image-assisted, adaptive symptom questionnaire and uploads prior
reports. The system compiles a structured clinical summary, grounds an LLM call on a doctor-curated
knowledge base, and produces a **decision-support differential assessment for a Registered Medical
Practitioner** — who reviews, overrides, and explicitly releases everything the patient ever sees.

> **The AI never diagnoses, never prescribes, and its output never reaches a patient.**
> Emergency escalation is deterministic and never waits on a model call.

---

## The four guardrails, and where they live

These are not policies written in a document and hoped for. Each is enforced somewhere a mistake
cannot quietly bypass.

| Guardrail | How it is enforced | Where |
|---|---|---|
| The AI cannot state a diagnosis | The output schema has no field capable of holding one, and it is `strict()`, so an added field is a rejection rather than something to trim | `packages/core/src/assessment/schema.ts` |
| Nothing reaches a patient unreviewed | The case state machine has **no edge** from any pre-review state to `released` | `packages/db/src/repositories/clinical-repository.ts` |
| Emergencies never wait on a model | A test walks the red-flag evaluator's transitive import graph and fails on any HTTP client, AI client, database import, or asynchrony | `packages/core/src/safety/no-ai-dependency.test.ts` |
| Clinical data is unreachable without consent and an audit trail | `@gi-compass/db` does not export the clinical tables at all — the only path is a repository that requires an `AccessContext`, applies the consent gate, and writes the audit entry in the same transaction | `packages/db/src/public-schema.ts` |

The audit trail is append-only at the **privilege** level: the application role holds `INSERT` and
`SELECT` on it and nothing else. A trigger refuses mutation even from the table owner.

---

## Running it

```bash
npm ci
cp .env.example .env               # in the repository root — see the note below
docker compose up -d               # PostgreSQL 16 + pgvector  (or ./scripts/dev-postgres.sh)
npm run db:migrate && npm run db:seed
npm run build -w @gi-compass/web
./scripts/dev-server.sh            # http://localhost:3000

npm test                           # 393 TypeScript tests
cd services/ai && uv venv .venv && uv pip install --python .venv/bin/python -e ".[dev]"
.venv/bin/python -m pytest         # 70 Python tests, no network
```

Registration sends a verification email, so `SMTP_URL` must point at a mail server. `docker
compose up` starts Mailpit for local use — its inbox is at http://localhost:8025. Without
`SMTP_URL` the message is written to the server log instead, link included, and its delivery row
records `logged_only` rather than `sent`.

The test suite never touches your database: it derives a `*_test` sibling, creates and migrates
it, and refuses to run its destructive helpers against anything else.

`.env` goes in the **repository root**. The web app walks up from `apps/web` to find it, since
Next.js only reads `.env` from its own directory and does not walk up in a monorepo. A `.env`
inside `apps/web` also works and takes precedence, and real environment variables beat both. The
server validates its configuration at startup and refuses to boot if anything required is missing,
rather than failing later on a request.

End-to-end browser walkthroughs live in [`e2e/`](e2e/README.md).

---

## Layout

```
packages/core     The clinical domain: questionnaire engine, red-flag rules, consent policy,
                  clinical-summary compiler, AI output schema. No database, no network, no
                  framework — so the safety-critical logic can be tested exhaustively.
packages/db       Schema, migrations, and the audited, consent-gated ClinicalRepository.
apps/web          Next.js 15 — patient, doctor, and admin interfaces plus the core REST API.
services/ai       Python FastAPI — the only component that talks to a model provider.
openspec/         Specifications and change proposals.
e2e/              Browser walkthroughs of the patient and doctor loops.
docs/RUNBOOK.md   Bringing it up from nothing, and what blocks a real launch.
```

---

## Spec-driven

Built with [OpenSpec](https://github.com/Fission-AI/OpenSpec): behaviour was specified before it was
written, and the specs are the contract the implementation is verified against.

```bash
npx @fission-ai/openspec show add-gi-compass-mvp
npx @fission-ai/openspec validate --strict
```

| Artifact | Path |
|---|---|
| Why & scope | `openspec/changes/add-gi-compass-mvp/proposal.md` |
| Behaviour contract, 16 capabilities | `openspec/changes/add-gi-compass-mvp/specs/**/spec.md` |
| Architecture & decisions | `openspec/changes/add-gi-compass-mvp/design.md` |
| Implementation checklist | `openspec/changes/add-gi-compass-mvp/tasks.md` |

Writing the specs first paid for itself twice. The seeded question bank failed publication
validation on a four-hop branching cycle and an unreachable question — both real content bugs, both
caught before a patient could hit them. And the spec's demand that the emergency path never depend
on the AI pipeline is what turned into the import-graph test, rather than a comment nobody checks.

---

## Regulatory frame

Architecture is shaped by these, not retrofitted to them:

- **Telemedicine Practice Guidelines 2020** — AI may only support a Registered Medical Practitioner.
- **CDSCO / Medical Device Rules 2017** — Phase 1 is framed as an internal clinical tool for
  affiliated doctors. **A regulatory opinion is a launch blocker.**
- **DPDP Act 2023 + DPDP Rules 2025** — health data is sensitive personal data; consent is a
  versioned, per-purpose, revocable object, and processing is gated on it in the data-access layer.
- **Data residency** — patient data stays in an India cloud region.

---

## What is deliberately not finished

Stated plainly, because a healthcare system that looks complete is more dangerous than one that
does not.

- **The clinical content is a starting point, not a validated instrument.** 61 questions, 29
  branching rules, and 17 red-flag rules drawn from the build brief's warning signs. Every prompt,
  branch, and threshold needs the clinical co-founder's review before a real patient sees it.
- **Reference images ship unpublished.** Their source and licence are placeholders, so a caption
  appears where a picture should be. Scraped clinical images are not an option.
- **Embeddings are a declared placeholder.** Retrieval reports itself non-semantic, so assessments
  are marked ungrounded rather than pretending to be grounded.
- **The malware scanner and the breached-password list are development stubs.**
- **Hindi clinical text is written but not clinician-approved**, so Hindi is not offered. The
  interface catalogue is at full parity, ready for it.
- **Retention ships with no periods set** — the job alerts rather than deletes until counsel sets
  them.

Seven product decisions are open. Each is implemented as the safer default and marked in code:

```bash
grep -rn "TODO(confirm): Decision" --include="*.ts" --include="*.tsx" --include="*.py" .
```

See `openspec/changes/add-gi-compass-mvp/design.md` § D13 for the table of defaults taken, and
[`docs/RUNBOOK.md`](docs/RUNBOOK.md) for what must be true before the first real patient.
