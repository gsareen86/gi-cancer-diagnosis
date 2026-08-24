/**
 * English clinical text for the seeded question bank.
 *
 * Plain language on purpose: a patient answering on a phone, possibly anxious, must be able to
 * answer accurately without a clinical vocabulary. Where a clinical term is unavoidable it is
 * paired with a `term.*.lay` explanation and the question carries it in `clinicalTerms`.
 *
 * Red-flag copy describes the *pattern of answers* and the need for urgent care. It never names
 * a condition — `validateEscalationCopy` refuses copy that does.
 *
 * TODO(confirm): every string here needs the clinical co-founder's review before publication.
 */
export const CLINICAL_TEXT_EN: Record<string, string> = {
  'entry.pain': 'Pain or discomfort in my tummy',
  'entry.bowel': 'A change in my bowel habits',
  'entry.bleeding': 'Blood when I go to the toilet',
  'entry.reflux': 'Heartburn, indigestion, or trouble swallowing',
  'entry.liver': 'Yellow eyes or skin, or swelling in my tummy',

  'group.pain': 'Pain',
  'group.bowel': 'Bowel habits',
  'group.bleeding': 'Bleeding',
  'group.reflux': 'Reflux and swallowing',
  'group.liver': 'Liver-related',
  'group.weight': 'Weight and appetite',
  'group.systemic': 'How you feel overall',
  'group.history': 'Your medical history',
  'group.meds': 'Medicines and lifestyle',

  /* -- Pain ------------------------------------------------------------------------------- */
  'q.pain_present.prompt': 'Do you have pain or discomfort anywhere in your tummy?',
  'q.pain_site.prompt': 'Where do you feel it? Tap every area that applies.',
  'q.pain_site.help':
    'Tap the diagram wherever you feel the pain. If it moves around, tap each place it reaches.',
  'q.pain_severity.prompt': 'At its worst, how bad is the pain?',
  'scale.pain.none': 'No pain',
  'scale.pain.worst': 'The worst pain I can imagine',
  'q.pain_duration.prompt': 'How long have you had this pain?',
  'q.pain_pattern.prompt': 'Which best describes the pain?',
  'opt.pain_pattern.constant': 'It is there all the time',
  'opt.pain_pattern.comes_and_goes': 'It comes and goes',
  'opt.pain_pattern.worse_after_eating': 'It gets worse after eating',
  'opt.pain_pattern.better_after_eating': 'It gets better after eating',
  'opt.pain_pattern.wakes_me_at_night': 'It wakes me at night',
  'q.pain_radiates.prompt': 'Does the pain spread anywhere else?',
  'opt.pain_radiates.to_back': 'Through to my back',
  'opt.pain_radiates.to_shoulder': 'Up to my shoulder or shoulder blade',
  'opt.pain_radiates.to_groin': 'Down towards my groin',
  'opt.pain_radiates.nowhere': 'It stays in one place',
  'q.pain_relief_position.prompt': 'Does anything change how bad it feels?',
  'opt.pain_relief_position.leaning_forward': 'Sitting up and leaning forward helps',
  'opt.pain_relief_position.lying_still': 'Lying completely still helps',
  'opt.pain_relief_position.nothing_helps': 'Nothing makes any difference',
  'q.abdomen_rigid.prompt':
    'Is your tummy hard to the touch, and does pressing on it hurt a lot?',
  'q.abdomen_rigid.help':
    'Press gently on your tummy with your fingertips. We are asking whether it feels stiff or ' +
    'board-like rather than soft, and whether pressing causes sharp pain.',
  'q.abdomen_distended.prompt': 'Is your tummy more swollen or bloated than usual?',
  'q.vomiting.prompt': 'Have you been vomiting?',
  'q.vomit_appearance.prompt': 'What did the vomit look like?',
  'opt.vomit_appearance.food_only': 'Food and fluid only',
  'opt.vomit_appearance.bile_green': 'Green or yellow',
  'opt.vomit_appearance.blood_red': 'It contained fresh red blood',
  'opt.vomit_appearance.coffee_grounds': 'Dark brown, like coffee grounds',
  'opt.vomit_appearance.faeculent': 'It smelled or looked like stool',
  'q.passing_wind_or_stool.prompt': 'Have you been able to pass wind or open your bowels?',
  'q.passing_wind_or_stool.help': 'Think about the last full day.',
  'opt.passing_wind_or_stool.both_normally': 'Yes, both as normal',
  'opt.passing_wind_or_stool.wind_only': 'Wind only, no stool',
  'opt.passing_wind_or_stool.neither_for_a_day': 'Neither, for a day or more',

  /* -- Bowel habit ------------------------------------------------------------------------ */
  'q.bowel_change.prompt': 'Have your bowel habits changed from what is normal for you?',
  'q.bowel_change_direction.prompt': 'How have they changed? Select everything that applies.',
  'opt.bowel_change_direction.looser': 'Looser or more watery',
  'opt.bowel_change_direction.harder': 'Harder or more difficult to pass',
  'opt.bowel_change_direction.more_often': 'More often than before',
  'opt.bowel_change_direction.less_often': 'Less often than before',
  'opt.bowel_change_direction.alternating': 'It swings between loose and hard',
  'q.bowel_change_duration.prompt': 'How long have they been like this?',
  'q.bowel_change_duration.help':
    'A change that has lasted more than a couple of weeks is worth a doctor looking at, ' +
    'whatever the cause.',
  'q.stool_form.prompt': 'Which picture is closest to your stool most of the time?',
  'q.stool_form.help':
    'This chart is a standard way of describing stool. Pick the closest match — it does not ' +
    'have to be exact.',
  'opt.stool_form.type_1': 'Separate hard lumps, like nuts',
  'opt.stool_form.type_2': 'Sausage-shaped but lumpy',
  'opt.stool_form.type_3': 'Sausage-shaped with cracks on the surface',
  'opt.stool_form.type_4': 'Smooth and soft, like a sausage or snake',
  'opt.stool_form.type_5': 'Soft blobs with clear edges',
  'opt.stool_form.type_6': 'Fluffy pieces with ragged edges, mushy',
  'opt.stool_form.type_7': 'Entirely liquid, no solid pieces',
  'q.stool_frequency.prompt': 'How many times a day do you open your bowels?',
  'q.night_time_stools.prompt': 'Do you have to get up at night to open your bowels?',
  'q.mucus_in_stool.prompt': 'Have you noticed slime or jelly-like mucus in your stool?',
  'q.urgency_incontinence.prompt':
    'Do you sometimes have to rush to the toilet, or have accidents?',
  'q.tenesmus.prompt':
    'After going, do you still feel as though you have not finished?',
  'term.tenesmus.lay':
    'A feeling of still needing to go, even straight after you have opened your bowels.',

  /* -- Bleeding --------------------------------------------------------------------------- */
  'q.blood_in_stool.prompt': 'Have you noticed blood when you pass stool?',
  'q.blood_appearance.prompt': 'What does the blood look like?',
  'q.blood_appearance.help':
    'The colour tells the doctor a lot about where the bleeding is coming from. Compare with ' +
    'the pictures and pick the closest.',
  'term.melaena.lay':
    'Very dark, black, sticky stool that often has a strong smell. It can be a sign of ' +
    'bleeding higher up in the digestive system.',
  'opt.blood_appearance.bright_red': 'Bright red',
  'opt.blood_appearance.dark_red': 'Dark red or maroon',
  'opt.blood_appearance.black_tarry': 'Black, sticky and tar-like',
  'q.blood_position.prompt': 'Where is the blood?',
  'opt.blood_position.mixed_in': 'Mixed all through the stool',
  'opt.blood_position.coating_surface': 'Coating the outside of the stool',
  'opt.blood_position.on_paper_only': 'Only on the toilet paper',
  'opt.blood_position.in_the_pan_only': 'Dripping into the toilet, separate from the stool',
  'q.blood_episodes.prompt': 'How many times have you seen blood in the past two weeks?',
  'q.blood_duration.prompt': 'How long has this been happening?',
  'q.anal_symptoms.prompt':
    'Do you have any of these around your back passage? Select everything that applies.',
  'opt.anal_symptoms.pain_on_passing': 'Pain when passing stool',
  'opt.anal_symptoms.itching': 'Itching',
  'opt.anal_symptoms.lump': 'A lump or swelling',
  'opt.anal_symptoms.none': 'None of these',
  'q.vomited_blood.prompt': 'Have you vomited blood, or something like coffee grounds?',

  /* -- Reflux ----------------------------------------------------------------------------- */
  'q.heartburn.prompt': 'Do you get a burning feeling in your chest or upper tummy?',
  'q.heartburn_frequency.prompt': 'How often does it happen?',
  'opt.heartburn_frequency.less_than_weekly': 'Less than once a week',
  'opt.heartburn_frequency.weekly': 'About once a week',
  'opt.heartburn_frequency.most_days': 'Most days',
  'opt.heartburn_frequency.daily': 'Every day',
  'q.heartburn_duration.prompt': 'How long have you had this?',
  'q.regurgitation.prompt':
    'Does food or sour liquid come back up into your throat or mouth?',
  'q.swallowing_difficulty.prompt': 'Do you have any difficulty swallowing?',
  'term.dysphagia.lay': 'Food or drink feeling as though it is slow, sticking, or hard to get down.',
  'opt.swallowing_difficulty.solids_only': 'Yes, with solid food only',
  'opt.swallowing_difficulty.solids_and_liquids': 'Yes, with both food and drink',
  'opt.swallowing_difficulty.food_sticks': 'Food actually sticks and I have to bring it back up',
  'q.swallowing_worsening.prompt': 'Has the swallowing difficulty been getting worse?',
  'q.early_satiety.prompt': 'Do you feel full much sooner than you used to when eating?',
  'q.early_satiety.help':
    'For example, feeling full after a few mouthfuls when you could previously finish a meal.',

  /* -- Liver ------------------------------------------------------------------------------ */
  'q.jaundice.prompt': 'Have the whites of your eyes or your skin turned yellow?',
  'q.jaundice.help':
    'The whites of the eyes usually change colour first, and it is easiest to see in daylight. ' +
    'Compare with the pictures.',
  'q.urine_colour.prompt': 'What colour is your urine?',
  'opt.urine_colour.pale': 'Very pale, almost clear',
  'opt.urine_colour.normal_yellow': 'Normal yellow',
  'opt.urine_colour.dark_amber': 'Dark amber',
  'opt.urine_colour.tea_or_cola': 'Very dark, like tea or cola',
  'q.stool_colour_pale.prompt': 'Has your stool become pale, clay-coloured or putty-coloured?',
  'q.itching_skin.prompt': 'Have you had itching all over your skin, without a rash?',
  'q.abdominal_swelling.prompt':
    'Has your tummy become swollen, so that clothes feel tighter around your waist?',
  'term.ascites.lay': 'A build-up of fluid inside the tummy, which makes it swell.',
  'q.leg_swelling.prompt': 'Have your ankles or legs become swollen?',
  'q.confusion_drowsiness.prompt':
    'Have you been unusually confused, forgetful, or very drowsy?',
  'q.confusion_drowsiness.help':
    'If someone close to you has noticed this even when you have not, please answer yes.',
  'q.easy_bruising.prompt': 'Do you bruise or bleed more easily than you used to?',

  /* -- Weight and appetite ---------------------------------------------------------------- */
  'q.weight_loss.prompt': 'Have you lost weight without trying to?',
  'q.weight_loss.help':
    'We mean weight that came off on its own — not from dieting, exercising more, or a change ' +
    'in what you eat.',
  'q.weight_loss_kg.prompt': 'Roughly how much weight have you lost?',
  'q.weight_loss_period.prompt': 'Over what period did you lose it?',
  'q.appetite_change.prompt': 'Has your appetite changed?',
  'opt.appetite_change.unchanged': 'No change',
  'opt.appetite_change.reduced': 'I am eating less than before',
  'opt.appetite_change.increased': 'I am eating more than before',

  /* -- Systemic --------------------------------------------------------------------------- */
  'q.lightheaded.prompt': 'Have you felt dizzy, lightheaded, or unusually weak?',
  'q.fainted.prompt': 'Have you fainted or blacked out?',
  'q.fever.prompt': 'Have you had a fever, or felt hot and shivery?',
  'q.night_sweats.prompt': 'Have you been waking up sweating at night?',
  'q.fatigue.prompt': 'Have you been unusually tired?',
  'q.unable_to_keep_fluids_down.prompt':
    'Are you unable to keep fluids down, even small sips of water?',
  'q.passing_much_less_urine.prompt': 'Are you passing much less urine than usual?',

  /* -- History ---------------------------------------------------------------------------- */
  'q.known_conditions.prompt':
    'Have you been told you have any of these? Select everything that applies.',
  'opt.known_conditions.ibd': 'An inflammatory bowel condition',
  'opt.known_conditions.peptic_ulcer': 'A stomach or duodenal ulcer',
  'opt.known_conditions.gallstones': 'Gallstones',
  'opt.known_conditions.liver_disease': 'A liver condition',
  'opt.known_conditions.pancreatitis': 'Inflammation of the pancreas',
  'opt.known_conditions.diabetes': 'Diabetes',
  'opt.known_conditions.none': 'None of these',
  'q.previous_gi_surgery.prompt': 'Have you ever had surgery on your tummy or bowel?',
  'q.previous_endoscopy.prompt':
    'Have you ever had a camera test of your stomach or bowel?',
  'q.family_gi_cancer.prompt':
    'Has a close blood relative had bowel, stomach, food-pipe, liver, or pancreas cancer?',
  'q.family_gi_cancer.help': 'Close blood relatives are parents, brothers and sisters, and children.',
  'q.family_ibd.prompt':
    'Has a close blood relative been told they have an inflammatory bowel condition?',
  'q.other_history.prompt':
    'Is there anything else about your health you think the doctor should know?',

  /* -- Medication and lifestyle ----------------------------------------------------------- */
  'q.painkiller_use.prompt':
    'How often do you take painkillers such as those for joint pain, headache, or fever?',
  'q.painkiller_use.help':
    'We mean anti-inflammatory painkillers in particular. If you are not sure which kind you ' +
    'take, answer as best you can and list them later.',
  'opt.painkiller_use.never': 'Never',
  'opt.painkiller_use.occasionally': 'Occasionally',
  'opt.painkiller_use.most_weeks': 'Most weeks',
  'opt.painkiller_use.daily': 'Every day',
  'q.acid_medication_use.prompt': 'Do you take anything regularly for acidity or heartburn?',
  'q.blood_thinner_use.prompt': 'Do you take anything that thins your blood?',
  'q.alcohol_use.prompt': 'How often do you drink alcohol?',
  'opt.alcohol_use.never': 'Never',
  'opt.alcohol_use.occasional': 'Occasionally',
  'opt.alcohol_use.weekly': 'About once a week',
  'opt.alcohol_use.most_days': 'Most days',
  'q.tobacco_use.prompt': 'Do you use tobacco in any form?',
  'opt.tobacco_use.never': 'Never',
  'opt.tobacco_use.former': 'I used to, but not now',
  'opt.tobacco_use.current_smoking': 'Yes, I smoke',
  'opt.tobacco_use.current_chewing': 'Yes, I chew tobacco, gutkha, or paan masala',
  'q.recent_travel_or_outside_food.prompt':
    'In the past month, have you travelled, or eaten food or drunk water you were unsure about?',
  'q.current_medications.prompt': 'Which medicines are you taking at the moment?',
  'q.current_medications.help':
    'Include anything you take regularly, and anything a doctor started recently. If you have a ' +
    'prescription, you can upload a photo of it instead.',

  /* -- Red-flag escalation copy ----------------------------------------------------------- */
  // Symptom-based, never condition-based. Each says what the answers describe and what to do.
  'redflag.upper_gi_bleed_with_hypovolaemia':
    'Your answers describe bleeding together with feeling faint or weak. This pattern needs ' +
    'urgent in-person care now — please go to the nearest emergency department.',
  'redflag.possible_perforation':
    'Your answers describe severe pain with a tummy that is hard to the touch. This pattern ' +
    'needs urgent in-person care now — please go to the nearest emergency department.',
  'redflag.possible_obstruction':
    'Your answers describe a swollen tummy with vomiting and nothing passing through. This ' +
    'pattern needs urgent in-person care now — please go to the nearest emergency department.',
  'redflag.severe_dehydration':
    'Your answers suggest you may be losing more fluid than you can replace. This needs urgent ' +
    'in-person care now — please go to the nearest emergency department.',
  'redflag.hepatic_decompensation':
    'Your answers describe yellowing together with confusion or bleeding. This pattern needs ' +
    'urgent in-person care now — please go to the nearest emergency department.',
  'redflag.biliary_sepsis':
    'Your answers describe yellowing with fever and pain on the right side. This pattern needs ' +
    'urgent in-person care now — please go to the nearest emergency department.',
  'redflag.progressive_dysphagia':
    'Your answers describe swallowing that is getting harder over time. This needs a specialist ' +
    'to see you soon.',
  'redflag.bleeding_with_weight_loss_over_45':
    'This combination of answers needs a specialist assessment soon.',
  'redflag.persistent_bowel_change_over_45':
    'A change in bowel habit lasting this long needs a specialist assessment soon.',
  'redflag.substantial_unintentional_weight_loss':
    'Losing this much weight without trying needs a specialist assessment soon.',
  'redflag.frequent_mixed_bleeding':
    'Repeated bleeding of this kind needs a specialist assessment soon.',
  'redflag.bloody_diarrhoea_with_fever':
    'Frequent loose stools with blood and fever need a specialist assessment soon.',
  'redflag.new_jaundice':
    'Yellowing of the eyes or skin always needs to be looked at by a doctor promptly.',
  'redflag.prolonged_bleeding':
    'This has been going on long enough that a doctor should review it.',
  'redflag.night_time_symptoms':
    'Symptoms that wake you at night are worth the reviewing doctor knowing about.',
  'redflag.longstanding_reflux':
    'Daily symptoms over many years are worth the reviewing doctor knowing about.',
  'redflag.family_history_with_symptoms':
    'Your family history alongside these symptoms is worth the reviewing doctor knowing about.',
};
