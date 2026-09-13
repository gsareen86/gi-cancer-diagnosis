# Pilot measurement protocol — draft for clinical approval

Version: `navigation-pilot-protocol-draft-1`, 2026-09-13.
Chosen outcomes: **clinical agreement and OPD time saved**. This document defines the
measurements; it supplies neither an approved protocol nor numerical success targets.

## Freeze before enrollment

Record the sites, dates, inclusion/exclusion criteria, sampling method, patient volume,
sample-size rationale, model/prompt/content versions, comparable usual-care baseline,
primary measures, success thresholds, missing-data treatment and safety review process.
The owner and clinical lead sign a version. Changes create a new version and are
reported separately; do not select the thresholds after seeing results.

Use consecutive eligible encounters or another predeclared method to reduce selection
of convenient examples. Separate the clinic and Metro, new and previously diagnosed
patients, report/no-report cases, language and self-service/assisted entry. Avoid many
tiny subgroup claims. A second independent clinician is desirable for disagreement
adjudication; until available, label results as agreement with the named clinical lead.

## Clinical agreement

The AI result is frozen to an input snapshot before clinician reveal. The clinician
can inspect the underlying patient answers, original reports and all safety advice,
then record a specialty choice and urgency assessment **without the AI suggestion**.
Record whether independent assessment was possible. A clinician who has already seen
the AI response contributes an assisted-review record, not a blinded agreement pair.

| Measure | Definition | What must accompany it |
| --- | --- | --- |
| Primary specialty agreement | Exact agreement of the AI's primary specialty code and independent clinician primary code / evaluable pairs | Numerator, denominator, missing/abstained/exposed cases, versioned specialty mapping and confusion matrix |
| Acceptable-route agreement | AI primary falls within a clinician-declared acceptable set | Secondary measure, set recorded before AI reveal; never inflate the primary denominator |
| Urgency agreement | Exact structured action/constraint agreement where comparable | Separate counts of AI less urgent, more urgent and not comparable; free-text similarity is insufficient |
| Differential usefulness | Clinician rates source fidelity, important omissions and inappropriate hypotheses | Clinician-only exploratory assessment, not “cancer detection accuracy” |
| Serious safety discrepancy | Potentially unsafe lower urgency, missed floor or conflicting released advice | Every event and disposition, even if aggregate agreement is high |

“No AI result”, “AI abstained”, “insufficient information”, “not independently assessed”,
“withdrawn”, and “reference missing” are separate statuses. None equals agreement or
disagreement by default. Denominators count **all eligible encounters**, with the
evaluable subset shown explicitly. Report confidence intervals only when a chosen
statistical method and sample support them; no precision claim from a few examples.

Differential ranking is not a probability estimate. A later documented diagnosis can
be linked as an outcome with its source/date and authority, but must not be leaked
into the AI input or independent reference for an earlier evaluation snapshot.
Care decisions take precedence over blinding; emergency information is always visible.

## OPD and staff time

Predeclare the comparator: a suitable usual-care period, alternating eligible sessions
or another clinically feasible design. “Before” and “after” cases should be comparable
in site, clinician and case mix. A time difference alone does not establish causality.

Capture distinct intervals with explicit start, pause, resume and finish controls:

- patient self-entry time and assisted entry time;
- coordinator setup, verification, report retake, clarification/callback and reset time;
- clinician usual-care history/report review, examination/consultation, documentation;
- clinician app review/correction, patient explanation and app-related rework;
- AI/report waiting time, queue delay and interruptions, recorded separately.

Per encounter, sum non-overlapping active intervals by actor and activity. Preserve
pause reasons and corrected observations. Do not infer clinician effort from tab-open
duration or background polling. Concurrent intervals from the same actor must be
reconciled; two actors working simultaneously still contribute separate staff effort.

Report median and distribution of active clinician minutes in each cohort, the
declared absolute/relative difference, sample counts and exclusions. Display staff
minutes alongside it; moving work to a coordinator is not automatically a net saving.
Missing or impossible timestamps produce “not measurable”, never zero minutes saved.

## Operational checks that explain the outcomes

Track completion/abandonment by stage, assistance needed, omitted clinically important
facts, extraction corrections, missing-report requests, unresolved clarifications,
AI failures and delay, review amendments, mismatched identities and unsafe guidance.
These are explanatory and safety measures, not replacements for the chosen outcomes.
Product analytics must not contain free-text clinical content or direct identifiers.

An approval click is not agreement. A released letter is not attendance. A downloaded
summary is not improved health. Keep those events distinct in the data model.

## Storage and audit

The initial implementation change defines pure contracts and tests with invented data.
The later evaluation workflow persists event/assessment versions under encounter and
site access controls, purpose-specific authority and an audit trail. Patient portals
and coordinators cannot read the AI/reference differential or evaluation exports.
Exports require authorised users and contain the minimum permitted data.

Real-data collection remains disabled until D01–D09 gates relevant to the site are
resolved, including retention and pilot-end disposition. Synthetic fixtures cannot
be mixed into pilot figures.
