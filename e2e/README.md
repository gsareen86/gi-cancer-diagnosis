# End-to-end walkthroughs

Browser-driven runs against a real server and a real database. They exist to check the things a
unit test cannot: that the emergency advisory actually interrupts a patient mid-interview, that the
release gate actually stops in front of a doctor, and that nothing clinical leaks into the screen
the patient reads.

```bash
./scripts/dev-postgres.sh                    # PostgreSQL 16 with pgvector
npm run db:migrate && npm run db:seed        # schema and clinical content
npm run build -w @gi-compass/web
./scripts/dev-server.sh                      # starts and waits until it answers

node e2e/patient-walkthrough.mjs             # register → interview → emergency
node e2e/doctor-review.mjs                   # queue → override → release → what the patient sees
node e2e/verify-hindi.mjs                    # approve Hindi, then restart and re-run with --check
```

Screenshots land in `/var/tmp/gi-shots` (override with `SHOTS=`).

## What each one proves

**`patient-walkthrough.mjs`** — registration does not disclose whether an address already has an
account; verification activates; the profile's date of birth gates the case; consent is granted per
purpose; the interview branches; the emergency advisory fires on the completing answer, shows 112
and 108, and names no condition; answers survive; the audit trail holds no answer values; and the
language switcher offers only languages whose clinical text a clinician has approved.

**`doctor-review.mjs`** — a doctor account lands on the second-factor gate; the queue shows the
emergency case; the case view carries the answers with their branching context, the red flags, and
the AI summary with its version pins and disclaimer; finalization refuses the AI summary passed
through and refuses a medication or dose; release takes an explicit confirmation showing the exact
patient-facing text; and the patient's own view contains the released summary and none of the AI
output.

**`verify-hindi.mjs`** — approving a language is a two-part act, because the question bank and the
red-flag rule set are versioned separately. It also needs a restart: a published version is
immutable, so the app caches it per version id and never expects one to change underneath.

## Doctor-side walkthroughs

```bash
DOCTOR_EMAIL=... DOCTOR_PASSWORD=... node e2e/doctor-onboarding.mjs

node e2e/stub-llama-server.mjs &                 # stands in for llama-server, port 8080
DOCTOR_EMAIL=... DOCTOR_PASSWORD=... node e2e/ai-analysis.mjs
```

**`doctor-onboarding.mjs`** — a privileged account lands on the second-factor gate and cannot pass
it without a code; enrolment offers both a QR and a typed key; the queue is reachable afterwards;
and the factor persists across a second sign-in. The TOTP code is computed the way a phone would.

**`ai-analysis.mjs`** — the doctor's *Generate AI analysis* button. Shows the recorded reason when
a previous run failed, then produces the structured panel: summary, ranked possibilities with the
findings behind each, the model's own concerns, suggested investigations, version pins, and the
disclaimer. Finishes by adopting the investigations into the doctor's own next steps.

**`stub-llama-server.mjs`** — speaks just enough of llama.cpp's OpenAI-compatible API to exercise
that path without a multi-gigabyte download. It answers from the JSON Schema it is sent rather than
from a fixed fixture, so the taxonomy enum actually reaching the model is genuinely covered. It
says nothing about whether a real model's clinical reasoning is any good.
