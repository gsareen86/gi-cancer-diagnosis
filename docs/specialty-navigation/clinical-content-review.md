# Clinical content inventory — not approved for patient use

Source: the clinical lead's questions pasted by the owner, 2026-09-13. **All wording,
codes, branching, units and thresholds below are draft.** This file does not publish
questionnaire content or create a clinical rule. The lead must approve actual patient
wording and coded sets, including translations, in the later authoring workflow.

Stable keys below are proposed data keys, not an instruction to replace existing
question IDs without migration. Each content record needs version, source, author,
reviewer, approval date, locale, options/units, applicable population and test scenarios.

## Common answer contract

Every clinical answer can be known, unknown/not sure, declined or not yet asked.
`no` is an explicit patient answer, not an empty default. A positive finding reveals
relevant details; unresolved safety follow-ups are still asked across entry branches.
Unselected multi-choice options do not by themselves establish clinical negatives.
Staff records who supplied the answer and who entered it. Report-derived suggestions
are separate claims until verified. Numeric values carry units, time and approximation.

Patient wording uses “the patient” in assisted mode rather than assuming the person
holding the tablet is the patient or that every attendant is a parent/child. Private
questions allow a return to patient-only entry or an explicit decline.

## A. Clinical-lead supplied domains — proposed structured representation

| Key | Proposed plain-language prompt / information | Proposed representation and review note |
| --- | --- | --- |
| `person.name` | Patient's name | Identity record, not a clinical-model input |
| `person.age` | Age or date of birth | Record exact versus estimated; don't fabricate a DOB from age |
| `person.sex` | Sex relevant to clinical assessment | Lead-approved options including unknown/declined; don't infer from name |
| `person.occupation` | What work does the patient usually do? | Optional text/coded category; purpose/minimisation review |
| `person.state` | State where the patient lives | State/UT code; no precise location required for specialty-type routing |
| `pain.present` | Is there pain in the abdomen? | yes/no/not sure |
| `pain.site` | Where is the pain? | Multiple body-map sites: right/left upper/lower, right/left side (lumbar), around navel; add upper middle/lower middle/generalised as proposed options for lead review |
| `pain.onset` | Did it begin suddenly or develop over time? | sudden/gradual/not sure plus date or approximate duration; separate recurring pattern |
| `pain.duration` | When did it start? How long does an episode last? | Number + minutes/hours/days/weeks/months; distinguish overall duration and episode duration |
| `pain.pattern` | Is it continuous, or does it come and go? | continuous/intermittent; if continuous, how many hours/days |
| `pain.resolution` | Does it settle on its own or only after medicine? | spontaneously/after_medicine/does_not_settle/varies; capture medicine separately |
| `pain.character` | Is it dull, or does it build up and ease off in waves? | dull/waves/other/not sure; clinical term “colicky” stays in clinician labels |
| `pain.score` | From 0 to 10, how strong is the pain? | Integer 0–10, time reference. Lead supplied mild 0–3, moderate 4–6, severe 7–10; record as **unapproved** interpretation, never automatic triage by this worksheet |
| `pain.radiation` | Does it travel anywhere else? | back/right_shoulder/loin/testis/other/none/not sure; clarify patient wording and laterality |
| `pain.meals` | Does eating make it better, worse or have no effect? | better/worse/no_change/not sure |
| `pain.posture` | Does bending forward or lying down change it? | Separate posture + better/worse/no_change/not sure; avoid a compound answer |
| `pain.recent_change` | Has longstanding pain recently become worse or changed? | yes/no/not sure plus when/how |
| `pain.relief` | What has helped? | spontaneously/oral_medicine/injection_or_IV/other/nothing/not sure; do not recommend a painkiller |
| `vomiting.present` | Has there been vomiting? | yes/no/not sure |
| `vomiting.duration` | For how long? | Number + duration unit; onset/date if known |
| `vomiting.frequency` | How many times in a day? | Approximate count with period; zero/current versus past separate |
| `vomiting.volume` | Roughly how much comes up each time? | Small/medium/large or familiar cup estimate. **Cup size is unresolved**; don't convert to exact mL without definition |
| `vomiting.content` | What did it look like? | green_yellow/undigested_food/partly_digested_food/other/not sure; blood details in bleeding domain |
| `vomiting.nausea` | Did the patient feel sick before vomiting? | yes/no/not sure |
| `vomiting.meals` | Does it happen after meals or at other times? | after_meals/unrelated/both/not sure plus approximate timing |
| `vomiting.relief` | Does vomiting relieve the discomfort? | yes/no/partly/not sure |
| `fever.present` | Has there been fever or feeling unusually hot? | yes/no/not sure; measured versus felt |
| `fever.duration` | For how long? | Number + unit |
| `fever.onset` | Did it begin suddenly or build up over days? | sudden/gradual/not sure |
| `fever.temperature` | Was the temperature measured? What was it? | Number + explicit °C/°F, time, device if known. Source says “less/more than 100 degree”; **unit, equality and threshold need clinical confirmation** |
| `fever.pattern` | Does it come and go or stay throughout? | intermittent/continuous/not sure |
| `fever.chills` | Has there been shivering or chills with the fever? | yes/no/not sure |
| `reflux.burning` | Burning in the chest or upper abdomen? | Separate site choices, yes/no/not sure; safety differential reviewed by lead |
| `reflux.fullness` | Fullness in the upper abdomen? | yes/no/not sure plus duration/impact |
| `reflux.bloating` | A bloated or swollen feeling? | yes/no/not sure; distinguish feeling from visible swelling |
| `reflux.regurgitation` | Does sour or bitter fluid come back into the mouth? | yes/no/not sure plus frequency/duration |
| `jaundice.eyes` | Have the whites of the eyes looked yellow? | yes/no/not sure; observer and time |
| `jaundice.urine` | Has urine become unusually dark/yellow? | Separate urine observation; not synonymous with confirmed jaundice |
| `jaundice.duration` | For how long? | Number + unit |
| `jaundice.onset` | Did it appear suddenly or gradually? | sudden/gradual/not sure |
| `jaundice.pattern` | Is the yellow colour persistent, worsening or coming and going? | persistent/progressive/intermittent/other/not sure; define waxing/waning wording |
| `jaundice.pain` | Has this occurred with abdominal pain? | yes/no/not sure; reach pain site/details without a branch-cycle gap |
| `itching.present` | Is there itching? | yes/no/not sure |
| `itching.distribution` | Is it all over the body or in one area? | generalised/localised/not sure; location if localised |
| `itching.impact` | Does itching disturb sleep or usual activities? | Separate sleep/activity choices and degree of impact |
| `bowel.change` | Have bowel habits changed from usual? | yes/no/not sure |
| `bowel.type` | Constipation, diarrhoea or alternating between them? | constipation/diarrhoea/alternating/other/not sure; explain terms |
| `bowel.onset` | Did the change begin suddenly or over days? | sudden/gradual/not sure |
| `bowel.duration` | How long has the change lasted? | Number + unit |
| `bowel.progression` | Is it improving, unchanged, worsening or variable? | improving/unchanged/worsening/variable/not sure |
| `bowel.laxatives` | Has the patient used anything to help pass stool? | yes/no/not sure; name, duration and effect in medications/remedies |
| `stool.colour` | What colour has the stool been? | black/silver_or_pale/yellow/other/not sure. Lead must define silver versus pale; colour is separate from stool form |
| `stool.frequency` | How often does the patient pass stool now, and usually? | Count + period for both; no default “once daily” |
| `stool.mucus` | Has there been mucus or a jelly-like coating? | yes/no/not sure; image optional after approval |
| `bleeding.vomit` | Has there been blood in vomit? | yes/no/not sure; reachable regardless of vomiting entry selection |
| `bleeding.trigger` | Did it happen without preceding retching or after repeated vomiting? | spontaneous/after_retching/other/not sure; exact wording reviewed |
| `bleeding.episodes` | How many episodes? | Approximate count + period |
| `bleeding.amount` | Roughly how much blood was seen? | Lead-approved familiar estimates, explicit uncertainty; no invented exact mL |
| `bleeding.appearance` | Was it fresh red blood or dark material like coffee grounds? | fresh_red/coffee_ground/both/other/not sure |
| `bleeding.clots` | Were clots seen? | yes/no/not sure |
| `bleeding.black_stool` | Black, sticky, tar-like stool? | yes/no/not sure plus current/recent; medication context kept separately |
| `bleeding.red_stool` | Fresh red blood passed with stool? | yes/no/not sure plus mixed/on_surface/separate and amount if lead approves |

The original nine domains are preserved above. Exact language and interpretation
still need sign-off: jargon translation, body-map regions, “silver stool”, cup volume,
temperature units, score time reference, overlapping patterns and culturally familiar
examples are content decisions, not details for a developer to guess.

## B. Proposed additions — not represented as the lead's original questions

These ten domains complete a review inventory of nineteen domains. Their inclusion,
branching and exact codes require the lead's decision. They are not all mandatory for
every patient and are not an approved cancer-screening instrument.

| Domain | Proposed fields | Why review it |
| --- | --- | --- |
| Swallowing | Difficulty with solids/liquids/both; onset, duration, progression, painful swallowing; able to swallow fluids/saliva | Specialty routing and safety coverage; don't assume solids-only is a negative |
| Weight change | Baseline/current weight with units/dates; amount/time; intentional versus unintentional; estimated versus measured | Preserve actual evidence rather than inferred loss or BMI claims |
| Appetite/early fullness | Appetite change; feeling full after a smaller meal; duration and impact | Adds context to upper-GI symptoms |
| Fatigue/possible anaemia context | Fatigue, breathlessness with effort, known anaemia and its documented test/date | Symptoms are not proof of anaemia; distinguish report from hypothesis |
| Lump/distension and acute function | Patient-noticed lump, location and duration; visible swelling/rigidity; passage of gas/stool; ability to keep fluids, urine reduction, dizziness/fainting/confusion | Lead chooses independent safety questions/rules; do not rely on a claimed minimal five-question set |
| Medications, remedies and allergies | Current/recent medicines with name/dose if known; start/stop dates; OTC/home/herbal remedies; response; allergies and reactions; iron/bismuth/NSAID/anticoagulant/antiplatelet/PPI context | History for review, not prescribing or automatic medication cessation advice |
| Past illness/surgery/current diagnosis | Existing clinician diagnoses with source/date; admissions, operations and complications; diabetes timing, gallstones, liver disease | Maintain confirmed/reported/unknown distinctions and clinically relevant chronology |
| Family history | Relationship, condition, age at diagnosis if known; GI cancers/polyps and other relevant conditions | Avoid treating unknown family history as none |
| Exposures and habits | Smoking, smokeless/chewed tobacco, betel/areca, alcohol with duration/amount; known hepatitis status with source | Patient-language/privacy review; don't infer risky behaviour from occupation or state |
| Previous consultations and investigations | Prior visits, advice and response; endoscopy/colonoscopy/imaging/pathology/lab dates and findings; surveillance advised; available reports | Optional evidence, relevant prior exclusion only with source; no invented “ruled out” condition |

## C. Rule-authoring worksheet structure

For each proposed rule, the lead must supply: rule ID/version, intended population,
all triggering facts, temporal relationships, severity/units and thresholds where
relevant, unknown-input behaviour, minimum action constraint, patient wording, staff
handover text, evidence source and review date. Record how corrected facts affect an
existing trigger; previous advice must not silently vanish on a branch change.

Every rule's scenario set includes positive, explicit-negative, unknown, contradictory,
partial, reordered-answer and every relevant entry-point path. Include AI timeout,
missing reports and a lower-urgency AI proposal. Software passes do not substitute for
clinical approval or establish sensitivity/specificity in actual patients.

## D. Sign-off record (intentionally empty)

Clinical author: pending named account. Clinical reviewer: pending named account.
Approved version/locales/value sets/rules: none in this reset. Approval date: unset.
Reference images: pending rights and clinical review; [candidate register](../reference-image-register.md).
Hindi: draft until the lead approves the actual patient text and reviewed scenarios.
