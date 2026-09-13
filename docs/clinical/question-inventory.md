# Question inventory: DRAFT, not approved for patient use

Load this for changes 3, 4 and 5 only. Sections 1–9 are the clinical lead's own question
areas (received 2026-09-13). Sections 10–20 are proposals for the clinical lead to accept,
change or drop. All wording, options, units and thresholds are **DRAFT** until signed off.

## Answer contract

- Every answer is one of: a value, **not sure**, **declined**, or **not yet asked**. "No" is
  an explicit answer, never a default. Unselected options are not negatives.
- Each answer records who supplied it (patient or attendant) and who entered it (patient
  or coordinator). In assisted mode, questions say "the patient", not "you".
- Numbers carry units, a time reference and whether they were measured or estimated.
- Report-extracted values stay separate until verified (invariant S8).

## Clinical lead's question areas

### 1. Abdominal pain
- Present: yes / no / not sure
- Site (multi-select body map): right upper, left upper, right side (lumbar), left side (lumbar), right lower, left lower, around the navel. *Proposed additions: upper middle, lower middle, all over*
- Onset: sudden / gradual; when it started (number + unit); how long an episode lasts
- Pattern: continuous (for how many hours/days) / comes and goes
- Settles: on its own / only after medicine / does not settle
- Character: dull / builds up and eases in waves (clinician label: colicky)
- Severity 0–10. *Lead's bands: mild 0–3, moderate 4–6, severe 7–10 (DRAFT)*
- Travels to: back / right shoulder / loin / testis / elsewhere / nowhere
- Effect of eating: better / worse / no change
- Effect of bending forward or lying down: better / worse / no change
- Longstanding pain that recently changed or worsened: yes / no / not sure
- What helped: settled on its own / tablets / injection or drip / other / nothing

### 2. Vomiting
- Present; for how long; times per day
- Amount each time: cup-based estimate. *Cup size undefined (DRAFT)*
- Looks like: green-yellow / undigested food / partly digested food / other
- Nausea before vomiting; after meals or unrelated to meals; does vomiting relieve the discomfort

### 3. Fever
- Present (measured or felt); for how long; onset sudden / gradual
- Temperature measured? Value + unit. *Lead's cut-off "100 degrees": unit and threshold to confirm*
- Comes and goes / continuous; with chills or shivering

### 4. Acidity and reflux
- Burning: chest / upper abdomen
- Fullness in the upper abdomen; bloated feeling
- Sour or bitter fluid coming back into the mouth

### 5. Jaundice
- Yellow whites of the eyes; dark yellow urine
- For how long; onset sudden / gradual
- Pattern: persistent / getting worse / comes and goes
- Occurring with abdominal pain

### 6. Itching
- Present; all over the body / one area
- Disturbs sleep / daily activities

### 7. Bowel habit
- Changed from usual; constipation / diarrhoea / alternating
- Onset sudden / gradual; how long; improving / same / worsening
- Anything used to help pass stool (name, how long, effect)

### 8. Stool
- Colour: black / silver or pale / yellow / other. *Lead to define "silver" vs "pale"*
- How often now, and how often usually (count + period)
- Mucus or jelly-like coating

### 9. Bleeding
- Blood in vomit: without retching / after repeated vomiting; episodes; amount (familiar estimate)
- Fresh red / dark like coffee grounds; clots
- Black, sticky, tar-like stool
- Fresh red blood with stool

## Proposed additions (for the clinical lead to decide)

| # | Area | Proposed fields |
| --- | --- | --- |
| 10 | **Care-seeking timeline** | Date of first symptom; first person consulted (GP, specialist, informal practitioner, pharmacist, nobody) and when; what it was treated as and medicines given; number of consultations before this visit; who referred and when. *This makes every intake a data point on where delay happens* |
| 11 | Swallowing | Difficulty with solids / liquids / both; onset; progression; painful swallowing |
| 12 | Weight | Unintentional loss: amount, over what period, measured or estimated |
| 13 | Appetite | Loss of appetite; feeling full after small meals |
| 14 | Fatigue / anaemia | Tiredness, breathlessness on effort; known anaemia with test and date |
| 15 | Acute function | Lump or visible swelling; unable to pass gas or stool; unable to keep fluids down; fainting or confusion |
| 16 | Medicines | Current and recent medicines, OTC and herbal remedies; NSAIDs, blood thinners, iron, acid reducers; allergies |
| 17 | Past history | Existing diagnoses (with source and date); operations; diabetes (especially new onset), gallstones, liver disease |
| 18 | Family history | GI cancers or polyps; relation; age at diagnosis |
| 19 | Exposures | Tobacco (smoked or chewed), betel/areca, alcohol (amount, years); hepatitis status |
| 20 | Past investigations | Endoscopy, colonoscopy, imaging, pathology, labs: dates, findings, whether reports are available |

Regional context for the lead's review: the gallbladder cancer belt along the Gangetic plain,
regional oesophageal patterns, high H. pylori prevalence, younger-onset colorectal cancer,
and abdominal tuberculosis as a common mimic.

## Specialty mapping (to author)

The clinical lead defines the specialty types a patient can be navigated to (for example
gastroenterology, GI/HPB surgery, surgical oncology, hepatology, general surgery, emergency
department) and the patient-facing name of each.

## Urgency rule worksheet

For each rule the clinical lead supplies:

- rule ID and version
- population
- triggering facts and time relationships
- thresholds with units
- behaviour when an input is unknown
- minimum urgency and patient advice wording
- staff handover text
- **provenance** (assumed / guideline-derived with source / locally-validated)
- reviewer and date

Every rule is tested with positive, explicit-negative, unknown, contradictory, partial and
reordered-answer scenarios, plus AI unavailable and AI proposing lower urgency. Passing tests
show the software behaves as written; they do not show the rule is clinically right.

## Sign-off record

Clinical author: pending · Approved content version: none · Approved rules: none · Approval date: none
