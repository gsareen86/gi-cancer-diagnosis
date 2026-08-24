# Deployment runbook

Bringing GI Compass up from nothing. Follow it in order — several steps exist specifically to make
a later guarantee true, and skipping one leaves the system looking correct while a control is
missing.

## Before you start

Two things are launch blockers, not deployment steps, and neither is in the code:

- **A regulatory opinion on CDSCO software-as-a-medical-device classification.** A tool that ingests
  symptoms and produces a differential list is likely in scope under the Medical Device Rules 2017.
  Phase 1 is framed as an internal clinical tool used by affiliated doctors, which is the
  lower-risk way to start — confirm that framing with counsel before it is offered publicly.
- **A settled Data Fiduciary under the DPDP Act**, with a named grievance officer. Until that is
  decided, the consent policy carries placeholders and the consent screen says so on the page.

## 1. Database

PostgreSQL 16 with `pgvector`, in an India region (AWS `ap-south-1`, Azure Central India, GCP
`asia-south1`). Data residency there is what keeps DPDP cross-border transfer obligations simple.

```bash
DATABASE_URL=postgres://owner@host:5432/gi_compass npx tsx packages/db/src/migrate.ts
```

The migrator creates the `vector` extension first — migration 0000 has a `vector` column and will
not apply without it — and then applies the schema.

**Verify the audit trail is actually append-only.** The application role must be able to insert and
read audit entries and nothing else:

```sql
SET ROLE gi_compass_app;
INSERT INTO audit_log_entries (action, target_type) VALUES ('runbook.check','case');  -- succeeds
UPDATE audit_log_entries SET action = 'tampered';                                      -- must fail
RESET ROLE;
```

If the `UPDATE` succeeds, stop: the accountability guarantee the whole design rests on is not in
place. Migration 0001 sets this up; re-run it against the right database.

Set the application's `DATABASE_URL` to connect as `gi_compass_app`, and give that role a password
out of band. Migrations run as the schema owner, never as the application.

## 2. Clinical content

```bash
DATABASE_URL=... npx tsx packages/db/src/seed/index.ts
```

The seed refuses to publish content that fails the same validation the admin console applies —
branching cycles, dangling rule targets, predicate/type mismatch, unreachable questions, clinical
terms with no lay explanation, red-flag copy naming a condition. A failure here is a content bug,
not an infrastructure one.

Reference images are seeded **unpublished**, because their source and licence are placeholders. A
patient will see a caption where a picture should be until licensed or clinician-authored originals
are supplied. That is deliberate: scraped clinical images are not an option.

## 3. Object storage

An S3-compatible bucket in the same India region, with:

- server-side encryption at rest,
- **no** public or anonymous read,
- a lifecycle policy matching the retention decision (see step 7).

The application never writes uploads to its own filesystem and never issues a URL longer than 15
minutes.

## 4. The AI service

`services/ai` is the only component that holds a model provider key. Deploy it inside the trust
boundary, reachable only from the core application, and set `AI_SERVICE_TOKEN` on both sides.

**Verify the core application cannot reach the provider directly** — the egress boundary being one
auditable place is the reason the service exists.

Two things it ships without, on purpose:

- **Embeddings are a declared placeholder.** `semantic_retrieval_available()` returns false until an
  embedding model is configured, and every assessment is marked ungrounded until then, which the
  reviewing doctor sees. Choosing one is a data-residency decision: a hosted embedding API sends the
  clinical summary out of the platform boundary.
- **OCR is local Tesseract**, with unmeasured accuracy on real Indian report scans. It sits behind
  one interface so a managed India-region OCR service can replace it.

## 5. Application

```bash
cp .env.example .env    # in the repository root
```

`.env` belongs in the **repository root**. The web app walks up from `apps/web` to find it, and
the migrate and seed scripts load it directly. A `.env` inside `apps/web` also works and takes
precedence; real environment variables beat both, so a container or systemd unit that sets them is
never overridden by a file left in a checkout.

The server validates its configuration at startup and refuses to boot if anything required is
missing, naming exactly what. It will not start half-configured and then fail on someone's first
registration.

Set every variable in `.env.example`. Two matter more than the rest:

- `FIELD_ENCRYPTION_KEY` encrypts the direct identifiers (name, phone, emergency contact). **Rotating
  it without a re-encryption plan makes existing records unreadable.**
- `SESSION_SECRET` signs access tokens and document URLs. Rotating it invalidates both, which is a
  deliberate action, not a routine one.

```bash
npm ci && npm run build -w @gi-compass/web && npm start -w @gi-compass/web
```

**Verify the Content-Security-Policy carries a per-request nonce**, not `'unsafe-inline'`:

```bash
curl -sI https://your-host/ | grep -i content-security-policy
```

It should contain `'nonce-…'`. Without it the framework's inline bootstrap is blocked and nothing
hydrates; with `'unsafe-inline'` instead, the directive is decorative.

## 6. First accounts

The seed creates a `platform_admin` with an unusable password hash — the account exists to own the
seeded content and **cannot be signed into**. Bootstrap a real one out of band:

```sql
UPDATE users SET email = 'you@your-practice.example', password_hash = '<argon2id hash>',
                 status = 'active'
 WHERE email = 'bootstrap-admin@gi-compass.invalid';
```

Then grant the clinical-admin and doctor roles from that account. Roles are never self-selected:
registration always yields `patient`.

Doctor, clinical-admin, and platform-admin accounts require a second factor. Until one is enrolled,
such an account holds an enrolment-scoped session that reaches the MFA endpoints and nothing else —
in particular, no patient clinical data.

## 7. Retention

Retention ships with **no periods set**, and the retention job alerts rather than deletes for any
category without one. That is the safe direction while the decision is open — but it means nothing
is being cleaned up. Set them with counsel:

```sql
UPDATE retention_policies SET retention_days = <n>, action = 'delete' WHERE category = '...';
```

Categories: `abandoned_draft_case`, `submitted_case`, `released_case`, `uploaded_document`,
`ai_assessment`, `audit_log`, `notification_delivery`.

## 8. Before the first real patient

- [ ] The clinician has walked the questionnaire through the admin preview and published it.
- [ ] Red-flag rules and thresholds are clinician-approved. The seeded set is a starting point drawn
      from the build brief's warning signs, not a validated triage instrument.
- [ ] A real malware scanner replaces the development stub in `file-inspection.ts`.
- [ ] A breached-password source replaces the small local list in `password-policy.ts`.
- [ ] Reference images are licensed or clinician-authored, attributed, and published.
- [ ] The privacy notice names the Data Fiduciary and a grievance officer.
- [ ] Hindi clinical text is clinician-approved, or Hindi is not offered. Approval is a two-part
      act: the question bank and the red-flag rule set are versioned separately.

Review the open product decisions before launch:

```bash
grep -rn "TODO(confirm): Decision" --include="*.ts" --include="*.tsx" --include="*.py" .
```

## Rolling back

The deployment is one database and two stateless services.

- **Code**: redeploy the previous image. If the schema changed, apply the down migration first.
- **Clinical content**: never roll back code for this. Published template versions are immutable, so
  a bad clinical change is reverted by republishing the previous version — which keeps every
  in-flight case on the version it started with.
