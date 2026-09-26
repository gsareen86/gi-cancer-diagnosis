# Contextual questionnaire: DRAFT, 22 September 2026

Content version: **intake-draft-2026-09-22.2**. Clinical author/approver: pending. All parameters are assumed adaptations. Independent software review does not approve clinical content or validate urgency decisions.

The revised questionnaire contains 129 possible questions across the 20 inventory areas, with conditional follow-ups. Patients see only the questions relevant to their current selections. It replaces broad yes/no bundles with symptom-specific descriptions, timing, recurrence, current versus worst severity, daily function and optional detail. Multi-location pain permits several selections; unknown, declined and exclusive options cannot be mixed with ordinary selections.

Immediate advice appears in an **Important** banner while the active question, Back, Continue and Save and pause remain usable. Advice never waits for saving, AI, reports or a clinician login. Continuing does not imply permission to delay care. The banner explains the matched rules and source answers; unknown safety answers remain explicit. Reports, review, paused intake and unavailable AI retain advice.

Current severe pain requires current pain plus current functional severity; worst historical pain is separate. Fainting, lightheadedness and confusion are distinct, with recovery/onset context. Same-illness yellowing, fever and current pain do not depend on a precise location selection; generalised pain remains eligible for the linked warning. Recovered historical fainting is not treated as current collapse. Current haematemesis, recent tar-like stool, heavy rectal bleeding and inability to swallow saliva retain specific safeguards. Symptom combinations require the stated temporal relationship, while incomplete warning histories retain prompt review. Alternate blood/stool appearance answers have their own linked clarifiers so an earlier denial cannot hide a later warning fact. Explicit differences in source answers remain visible for reconciliation.

The verbal current severity scale is a deliberate DRAFT deviation from the lead's numerical worst-pain bands. Felt fever is recorded as reported fever; no temperature cutoff is inferred from the unresolved “100 degrees” item. Numeric descriptions request units, period and measured/estimated status. Rule metadata contains population, version, sources, adaptation rationale, unknown behavior, advice and staff handover. Source quotes and access dates are in the content source catalog; UK service routing is adapted to existing clinic/hospital wording. The clinical lead must assess these adaptations and the 25-case clinical review separately.

Each new or edited answer retains its stated supplier/enterer even if someone else helps later. Existing answers without per-answer attribution retain their intake-level attribution. Unknown, declined, not-yet-answered and inactive earlier details are distinct. Earlier details remain reviewable after a parent changes; they do not silently become current rule inputs or AI evidence. Optional free text is saved and available for review but does not secretly drive deterministic triage.

New visits use this version. Historical encounters, source snapshots and queued jobs remain pinned to the previous questionnaire and rules. Their UI uses the same nonblocking banner but preserves the original options. Start a new visit to use the revised questionnaire. No stored clinical answers or clinical rules are silently reinterpreted.

## Inventory coverage

| Area | Versioned question IDs |
| --- | --- |
| 1. Abdominal pain | `pain_presence`, `pain_now_severity`, `pain_onset`, `pain_site`, `pain_touch`, `pain_started`, `pain_pattern`, `pain_frequency`, `pain_episode_length`, `pain_score`, `pain_character`, `pain_radiates`, `food_effect`, `position_effect`, `pain_relief`, `pain_change` |
| 2. Vomiting | `vomiting`, `vomiting_frequency`, `vomiting_started`, `vomiting_appearance`, `vomiting_amount`, `vomiting_meals`, `vomiting_nausea`, `vomiting_relief` |
| 3. Fever | `fever`, `fever_chills`, `fever_started`, `fever_pattern`, `fever_onset`, `fever_measurement` |
| 4. Acidity and reflux | `reflux`, `reflux_frequency`, `reflux_started`, `reflux_triggers`, `upper_fullness` |
| 5. Jaundice | `jaundice`, `biliary_episode`, `jaundice_started`, `jaundice_onset`, `jaundice_pattern`, `urine_colour` |
| 6. Itching | `itching`, `itch_started`, `itch_impact` |
| 7. Bowel habit | `bowel_change`, `bowel_started`, `bowel_onset`, `bowel_trend`, `bowel_treatment` |
| 8. Stool | `bowel_frequency`, `stool_colour`, `mucus` |
| 9. Bleeding | `vomit_blood`, `vomit_blood_timing`, `vomit_blood_amount`, `bleeding_unwell`, `black_stool`, `black_stool_timing`, `rectal_blood`, `rectal_blood_timing`, `rectal_blood_amount`, `appearance_blood_timing`, `appearance_blood_unwell`, `appearance_blood_amount`, `vomit_retching`, `appearance_stool_timing`, `appearance_stool_amount`, `bleeding_frequency`, `bleeding_details` |
| 10. Care-seeking timeline | `concern`, `duration`, `pattern`, `first_symptom_date`, `first_contact`, `first_contact_date`, `previous_treatment`, `treatment_effect`, `visits`, `referral`, `anything_else` |
| 11. Swallowing | `swallowing`, `saliva_now`, `swallowing_started`, `swallowing_trend`, `swallowing_pain` |
| 12. Weight | `weight_loss`, `weight_details` |
| 13. Appetite | `early_full`, `appetite`, `appetite_started` |
| 14. Fatigue / anaemia | `fatigue`, `breathlessness`, `anaemia`, `anaemia_details` |
| 15. Acute function | `faint`, `faint_timing`, `faint_recovery`, `faint_context`, `confusion`, `confusion_onset`, `fluids`, `fluid_duration`, `urine`, `distended`, `no_gas`, `obstruction_episode`, `lump`, `lump_details` |
| 16. Medicines and allergies | `medicines_status`, `medicines`, `allergy_status`, `allergies` |
| 17. Past history | `conditions`, `surgery`, `tb_history`, `tb_details`, `night_sweats` |
| 18. Family history | `family_status`, `family` |
| 19. Exposures | `tobacco`, `tobacco_details`, `areca`, `areca_details`, `alcohol`, `alcohol_details`, `hepatitis`, `hepatitis_details` |
| 20. Past investigations | `previous_tests_status`, `previous_tests` |

## Software verification

The follow-up presentation revision groups the current DRAFT questions into 15 main
topics. Its 55 possible main questions include all 37 warning-rule fields and transitive
parents; conditional visibility means patients see only relevant follow-ups. The other
74 questions are optional detail selected from review. No clinical rule, wording or
answer option changes in this revision. Topic/mode resumes from the saved intake;
skipped details remain unknown. All 129 questions remain available, and historical
clinical versions retain their prior presentation.

Follow-up verification passed 145 unit checks, 454 isolated SQL assertions, 12 responsive
questionnaire browser cases, and 10 real Auth/MFA workflow checks including short
assessment saves and a generated PDF processed through the leased Gemini worker.
These checks establish software behavior only. The owner's uploaded PDF has not been
replayed; explicit authorization for its Gemini transfer remains pending.

Current correction: 130 unit tests passed, including 50 contextual questionnaire tests; 419 isolated Cloud SQL assertions passed both during rollback verification and after test-project migration; 12 browser cases passed at desktop/tablet/phone widths with a synthetic in-memory API. The browser suite tests continued answering, focus, pause/resume, multi-selection, save failure, review and unavailable output. SQL tests separately cover actual database validation, legacy contracts, access isolation and stale publication. Production build, typecheck and lint passed. A real fresh fictional visit on the running production build verified consent, latest content, continued answering with Important advice, saved attribution, pause/reload and session reset. All six runtime preflight checks passed. Gemini generated a fictional assessment through the configured gateway and passed evidence/semantic checks. These results establish software behavior, not clinical validity. Both forward migrations are applied to the existing synthetic test and demo projects. The app and worker were restarted. Exact bundled/stored JSON equality passed for all three supported content versions on both projects. The completed Claude review found two blockers, both fixed and covered by browser regression. An internal independent Codex follow-up found no remaining blockers; a repeat external Claude transmission was blocked by automatic approval review and was not performed. The broader demo change remains open for its previous gates.
