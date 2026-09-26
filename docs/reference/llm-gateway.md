# LLM Gateway: contract to reverify during the fresh build

Implementation update, 22 September: selectable local/Gemini/compatible adapters and
versioned assessment, extraction and factual-check prompts now live in `src/lib/ai`.
See [operator configuration and measured verification](ai-providers.md). Existing
environment and data-governance restrictions remain separate from connector capability.

Load for changes 6–8. This specifies desired behaviour; old runtime/model settings are not
proof for the new stack. No old implementation is imported implicitly.

## Role and approved connectors

The sole model-egress service receives a minimised, versioned encounter snapshot and an
output schema. Internal callers authenticate; providers are selected from an explicit
per-environment allowlist. Initial demo uses a pinned local llama.cpp build/model; pilot
uses a verified Azure OpenAI regional India deployment. Unknown/unavailable connectors
fail explicitly; no silent fallback. Credentials stay outside browser/runtime logs.

Every connector has executable contract tests for its actual API version: strict structured
output, refusal, malformed/truncated output, context limit, served-model identity, timeout,
health and error redaction. Pin binary/model hash or deployment/model version. No inherited
claim about a particular model's temperature, thinking mode or sleep flag is accepted without
checking its documentation and testing the selected version. Add providers only by a scoped
change; synthetic-only development providers never become pilot fallbacks.

## Asynchronous execution and versions

Use durable jobs in Supabase Postgres and an independently running worker. Enqueue atomically
with input snapshot/consent/site/version, unique idempotency key and status. Workers claim
leased jobs, heartbeat, retry transient failures with bounded exponential backoff, and mark
permanent failures for clinician/manual handling. A local model may take minutes; the browser
receives a job ID and progress state rather than holding the only execution request open.

Check consent and current snapshot before work and before publishing. Duplicate delivery is
safe, withdrawal cancels publication, and results for superseded snapshots are retained only
as appropriately governed historical artifacts, never released as the current assessment.
The clinician's worklist remains usable throughout AI failure or processing delay.

## Structured output and source support

Caller validation remains mandatory despite provider schema constraints. Do not repair output
silently or treat a second model's agreement as truth. Keep source document/page/field IDs,
verification status and missing/contradictory facts through compilation. Report text and patient
free text are data, not instructions. Patient-facing possible diagnoses are an explicitly
preliminary projection under S5, with concise factual reasoning, uncertainty and care navigation;
clinician internal notes and private model reasoning never leak into it.

Use the selected model's tokenizer and enforce input plus output budgets. If a snapshot cannot
fit, use explicit source-preserving chunking/summarisation with provenance or return incomplete.
Never rely on a character estimate plus a warning before silent truncation. Never drop safety
facts, medication/history fields or contradictory evidence without recording incompleteness.

## Failure, privacy and lifecycle

Output states include queued, running, completed, refused, incomplete, failed and cancelled.
Use coded errors and request IDs; no raw provider error/body, prompts, tokens or clinical data
in ordinary logs. Immediate-care advice runs independently. Valid patient output cannot
reduce the deterministic floor, fabricate evidence, show probabilities, claim a confirmed
diagnosis or silently describe itself as clinician-reviewed.

Health checks report configured/served model and readiness without issuing clinical prompts.
Sleep/wake behaviour is capability-tested against the pinned runtime; never kill unknown
processes, download models automatically or assume historic command flags are supported.
Local binary/weight paths remain operator configuration, not committed machine-specific paths.
