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
node e2e/doctor-onboarding.mjs

node e2e/stub-llama-server.mjs &                 # stands in for llama-server, port 8099
LLAMA_SERVER_URL=http://127.0.0.1:8099 <restart the AI service>
node e2e/ai-analysis.mjs
```

Both create their own throwaway doctor, and `ai-analysis.mjs` seeds its own case for that doctor to
open. They read the enrolment secret off the screen, so they need an account with no second factor —
and getting that by clearing an existing one silently invalidates whatever is in that person's
authenticator app, with no way back except enrolling again. `DOCTOR_EMAIL` and `DOCTOR_PASSWORD`
still override, but the account you name must already be un-enrolled: the scripts will not clear a
factor for you. `npm run user -- list` shows which accounts have one.

To put a case in your own doctor's queue without answering the interview by hand:

```bash
npm run demo-case -- doctor@example.com
```

It drives the app's own interview service and state machine rather than inserting rows, so the case
it leaves behind went through validation, red-flag evaluation, and the transitions a real one does.

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

It listens on **8099, not 8080**, and reports itself as `stub-llama-server/not-a-real-model` from
both `/v1/models` and every completion. Both of those are scar tissue. It used to default to 8080,
where a real llama-server lives; one left running meant every case came back with the same canned
summary in under a second, and the version pins on the doctor's screen named the real model —
because the recorded name came from `LOCAL_MODEL_NAME` rather than from whatever answered. The
service now records what the server says it is, so a stub cannot wear a model's name, and
`/health` probes the endpoint instead of reciting the configuration back.

## Reading the screen

Assertions go through `support/page-text.mjs`, which exists because the obvious thing is wrong.
`textContent('body')` includes `<script>` contents, and Next inlines the entire message catalogue
into the document — so a substring check against it matched the English translation of the key and
passed on a blank screen. `visibleText()` uses `innerText`, which is computed from layout. Because
that reflects CSS, `text-transform: uppercase` headings come back uppercased, so `has()` compares
case-insensitively. `deliveredText()` returns everything the browser was sent and is for leak checks
only — content that reached a patient's device leaked whether or not anything drew it.
