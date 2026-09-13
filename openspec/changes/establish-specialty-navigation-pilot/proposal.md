## Why

The owner and clinical lead now want GI specialty navigation: structured intake and
AI hypotheses that help a clinician choose the right type of doctor and review urgency.
The previous early-care backlog does not describe the agreed tablet-based clinic pilot
or its two chosen outcomes, clinician agreement and OPD time saved.

## What Changes

- **BREAKING product direction:** replace early-detection positioning and the old
  active backlog with the 2026-09-13 brief; preserve old code and specs as history.
- Establish one current operating contract for a synthetic local demo and a separately
  authorised real-data pilot. Record ownership intent, company processing, proposed
  clinic/Metro sites, local versus Azure inference, and unresolved pilot-data decisions.
- Specify a responsive clinic encounter: patient self-service or coordinator-assisted
  tablet intake, optional existing reports, explicit clinician review, specialty-type
  navigation, and a separate patient artifact without the AI differential.
- Make the first implementation increment a testable **demo/pilot boundary and
  current-scope entry surface**, with pilot activation closed until evidence exists.
- Define data-free pilot metric contracts now, including independent clinician answers
  before AI reveal, disagreements and explicit time intervals; subsequent changes will
  persist and display these with real encounters.
- Provide a bounded sequence for the remaining production application, plus a draft
  clinical content inventory for the lead to review. No new clinical rule is approved
  by this proposal.

## Capabilities

### New Capabilities

- `navigation-operating-boundary`: explicit local-demo versus pilot behaviour,
  accountable configuration and prevention of accidental patient-data activation.
- `navigation-entry-surface`: current-purpose landing/entry content and responsive
  tablet/desktop/phone affordances without advertising unfinished pilot capabilities.
- `navigation-evaluation-contract`: versioned, non-PHI measurement contracts for
  specialty agreement, urgency disagreement and human OPD/staff time.

### Modified Capabilities

None. There are no published main specs in `openspec/specs` at this checkpoint.
The three previous unarchived changes are preserved outside active OpenSpec discovery;
they are not treated as implemented main specs.

## Non-goals

This first increment does not implement the entire clinic pilot. Its follow-on changes
cover encounter/site access, consent, questionnaire authoring, reports, AI reasoning,
review/release and persistent measurement. It does not enable real-patient collection,
approve clinical wording or rules, guarantee diagnostic accuracy, or publish Hindi.

V1 excludes early-detection/cancer-screening claims, autonomous diagnosis or prescribing,
patient-visible AI differentials, named-doctor recommendations, payments, phone OTP,
WhatsApp, emergency calls/SOS, automated staging and interpretation of raw CT/MRI scans.
Existing radiology **reports** remain optional and important inputs.

## Impact

Planning: `openspec/config.yaml`, the new change, `docs/specialty-navigation`, a short
session entry file, and historical planning relocation. Implementation: shared operating
and metric contracts, server-side activation checks, entry-page translations/layout,
synthetic fixtures and tests. Preserve the existing monorepo and migrations.

Patient-data processing needs purpose-specific authority and site arrangements; the
company's proposed role and hospital affiliation alone do not establish those facts.
India residency is the owner's policy. Azure deployment type and data-handling terms
must support it. An internal pilot or a disclaimer does not itself resolve medical
software classification or clinical responsibility; those remain documented pilot gates.
