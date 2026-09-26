# Patient entry, reports and AI configuration

Implementation record, updated 26 September 2026. This describes software configuration, not
clinical approval. Existing site governance and clinical-content approval remain separate.
Verification uses fictional data; the final full rehearsal also runs on the actual demo project.

## URLs

| Surface | URL | Access |
| --- | --- | --- |
| Patient entry | `/start/<clinic-slug>` | Public; no account required |
| Current questionnaire and results | `/patient` | Expiring HttpOnly encounter capability |
| Staff workspace | `/staff` | Staff Auth, MFA, active site membership |
| Provider choice | `/staff/ai` | Site administrator |

`/` and `/start` use `PATIENT_ENTRY_SLUG`. Configure a designated fictional clinic after
migrations with `npm run intake:configure -- --site <uuid> --slug <slug> --mode synthetic`.
`--list` lists sites with an active clinical reviewer. Rebuild/restart after setting the
default slug. New visits collect clinical information only after consent, remain assigned,
and expire on the device after two hours. Ending a device session does not close a visit.

Public creation is a narrow server-only RPC. The server reads its credential from
`SUPABASE_AUTH_ADMIN_KEY` or ignored `.env.operator`; it never sends it to the browser.
The database limits each clinic to 120 starts per hour. Internet-facing deployment still
needs per-client abuse controls and an appropriate capacity limit.

## Selecting a provider

Copy `.env.ai.example` to ignored `.env.ai`, add credentials there, then use **AI settings**
in the staff sidebar. The selected provider is saved to `var/ai/selection.json`. A process
environment `AI_PROVIDER` overrides this file and visibly locks the selector. An
`AI_PROVIDER` inside `.env.ai` is only the initial default. Credentials stay server-side.
Running requests retain their selected settings; new requests use the new choice.
There is no automatic fallback to a different provider.

| Adapter | Configuration | Contract |
| --- | --- | --- |
| Local llama.cpp | `.env.model`, optional `LOCAL_AI_*` overrides | Pinned model, executable and optional vision projector; served model/context/vision checks |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_ENDPOINT` | Native content arrays, image parts, token count, JSON schema, refusal/truncation handling |
| Compatible | `COMPATIBLE_ENDPOINT`, `COMPATIBLE_MODEL`, `COMPATIBLE_API_KEY` | HTTPS `/v1/models`, `/v1/chat/completions`, and `/tokenize` returning `total_tokens` or `tokens` |

The Gemini default model is `gemini-3.8-flash`; it can be replaced without changing clinical
code. On 22 September the owner's key in ignored `.env.ai` passed model health and an actual
fictional questionnaire assessment through the gateway, including source and semantic checks.
The check used a process-only provider override; the saved provider choice remains controlled
by AI settings. No key was printed, committed or copied from another application.

The compatible adapter is a contract, not a claim that every vendor works unchanged.
Add a native adapter for different authentication, tokenization or schemas. Remote
deployments retain the existing India-routing checks; model selection and credentials
alone are not evidence of residency or deployment approval.

## Reports and clinical analysis

Uploads accept PDF, PNG and JPEG, at most 5 MB per file, five files per visit and 30 PDF
pages. PDF active content is rejected; photo size/contrast checks request a clearer image.
Camera entry is available in the patient report flow. Uploads are saved before processing.

The independent worker leases reports, renders PDF pages or reads native text, and asks
the selected model for structured findings and source quotes. This is model-based
document extraction, not a regex analyte parser. Images are bounded before inference;
vision must be enabled in the served local model. Extraction failure keeps the original
available for staff inspection and manual findings. Exhausted leases become visible
failures. Completed, non-rejected machine findings enter preliminary analysis automatically,
with unreviewed extraction provenance and printed source quotes, units, reference intervals,
report type, date and page. Staff can optionally review/correct/reject them; unconfirmed
manual transcriptions are excluded. Terminal report changes on submitted encounters cancel
older jobs and enqueue a fresh immutable snapshot. Pending reports defer assessment claims.
Failed/empty reports are unknown, never negative. Saved clinician drafts survive evidence
changes with their original source version until the clinician explicitly reviews new facts.

Assessment, extraction and factual-check prompts are DRAFT versioned content in
`src/lib/ai/prompts.json`. Clinical prompts contain no synthetic-demo framing. Generation
uses short evidence aliases, structured next steps and specialty reasoning, followed by
schema, evidence and semantic checks. Two corrective retries receive specific failure
codes. Regex guards are additional output boundaries, never the generator or extractor.
Unknown answers remain unknown; AI can raise but cannot lower the rule-based urgency floor.
Failure stays visible, with saved answers and assigned clinical review; no substitute
assessment is fabricated. Context exhaustion returns an explicit incomplete/unavailable
state instead of silently dropping facts.

Local PDF/photo processing runs one page at a time. Text requests use the local tokenizer;
image embedding limits are enforced by llama.cpp at inference. The current machine has
one slot, so extraction and assessment execute serially. A tested fictional report page
yielded 12 unverified findings in 125 seconds. A separate complete worker run published
12 unverified findings in 104 seconds with four successful lease renewals. These are performance observations, not an
accuracy measure or latency guarantee.

## Operation and verification

```powershell
npm run demo:start -- -RestartWorker
npm run demo:preflight
npm run demo:rehearse
npm run demo:rehearse -- --live-ai
npm run demo:rehearse -- --demo
npm run ai:verify
npx tsx scripts/verify-report-worker.ts
```

The launcher only starts llama.cpp when Local AI is selected. Local vision needs
`LLAMA_MMPROJ` and its SHA256 pin in `.env.model`; the startup receipt and health check
must agree. `LLAMA_CONTEXT` controls local context size. Measure memory headroom before
increasing it.

The browser rehearsal creates isolated fictional staff and visits, signs in with actual
Auth/MFA, and exercises public intake, urgent/pause screens, PDF viewing, staff evidence
verification, independent review, plan release, provider settings and reset at desktop,
tablet and phone sizes. `--live-ai` also generates an assessment, opens its evidence detail
and persists six-dimensional feedback. Fictional artifacts live in ignored `var/ui-review`;
ordinary application logs contain no clinical payloads.

Historical 22 September database verification: 183 assertions on the isolated project, including
cross-site/capability boundaries, staff-only evidence verification, immutable snapshots,
stale publication, consent withdrawal and exhausted report leases. Unit suite: 80 tests.
The active change records final verification outcomes separately.

Historical focused inference passed with prompt `gi-assessment-2026-09-22.2`, including the
instructions against converting absent examination evidence into a negative finding.
The full live browser rehearsal passed 25 checks, including saved dimension-level feedback
and patient reset. Nine public browser checks and 35 hosted Auth checks passed. The app
and worker were rebuilt/restarted after the final corrections. Local inference can still
take several minutes; this run is functional evidence, not a reliability or accuracy study.

The primary public link is `/start/gi-clinic`. Its existing fictional data mode is retained.

The current DRAFT prompt is `gi-assessment-2026-09-26.4`. It adds automatic-report
provenance, distinct uncertainty and plain patient-language checks. Older incompatible
AI is withheld from current views without deleting historical results or clinician plans.
During the report-rich live rehearsal, excessive evidence citations exposed generic
schema retry feedback. The gateway now sends field paths/codes/numeric bounds back to
the selected model and enforces the full schema after generation; it does not truncate
evidence or weaken validation. See the current readiness record for final test results.
The six tested migrations were applied to the existing application project after explicit
owner approval. Automatic approval review rejected changing the foundational synthetic-only
policy; a separate runtime-only policy update is awaiting the owner's explicit response.
No real patient record or report was used during this work.

## Remaining deployment work

Report bytes still use bounded private Postgres storage. Large documents, resumable upload
and migration to private object storage are not implemented. Optional returning-patient
accounts, multilingual content, longitudinal identity and named urgency acknowledgment
remain separate work. Clinical rules and prompts remain DRAFT, with independent
implementation review, clinical approval and foundation operational gates still open.

The test-project Supabase security advisor reported existing intentional restricted
SECURITY DEFINER entry points and an operator-only audit table with no browser policy.
Role/capability boundaries are SQL-tested. It also reported disabled leaked-password
protection; deployment review should follow [Supabase password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
These are not a claim of a clean security audit or hospital-scale readiness.
