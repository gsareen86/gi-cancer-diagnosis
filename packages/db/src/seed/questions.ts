import type { Question, QuestionGroup, EntryPoint, BranchingRule } from '@gi-compass/core';

/**
 * The Phase 1 question bank, expressed entirely as data.
 *
 * This is a starting point for the clinical co-founder to edit through the admin console, not a
 * validated instrument. Every prompt, option, and branch here needs clinician review before it
 * is published to a real patient.
 *
 * TODO(confirm): the whole bank awaits clinical sign-off — wording, branch structure, and the
 * thresholds baked into the numeric questions.
 */

const base = {
  clinicalTerms: [] as Question['clinicalTerms'],
  options: [] as Question['options'],
  bodyMapRegionIds: [] as string[],
  referenceImageIds: [] as string[],
  required: true,
  textMaxLength: 2000,
};

type OptionSpec = [id: string, polarity: 'affirms' | 'denies' | 'indeterminate', imageIds?: string[]];

const opts = (questionId: string, specs: OptionSpec[]): Question['options'] =>
  specs.map(([id, polarity, imageIds], order) => ({
    id,
    labelKey: `opt.${questionId}.${id}`,
    order,
    referenceImageIds: imageIds ?? [],
    polarity,
  }));

const yesNo = (questionId: string, includeUnsure = true): Question['options'] =>
  opts(questionId, [
    ['yes', 'affirms'],
    ['no', 'denies'],
    ...(includeUnsure ? ([['unsure', 'indeterminate']] as OptionSpec[]) : []),
  ]);

const q = (
  id: string,
  groupId: string,
  type: Question['type'],
  order: number,
  extra: Partial<Question> = {},
): Question => ({
  ...base,
  id,
  groupId,
  type,
  promptKey: `q.${id}.prompt`,
  order,
  ...extra,
});

export const GROUPS: QuestionGroup[] = [
  { id: 'grp_pain', labelKey: 'group.pain', cluster: 'pain', order: 0 },
  { id: 'grp_bowel', labelKey: 'group.bowel', cluster: 'bowel_habit', order: 1 },
  { id: 'grp_bleeding', labelKey: 'group.bleeding', cluster: 'bleeding', order: 2 },
  { id: 'grp_reflux', labelKey: 'group.reflux', cluster: 'reflux_upper_gi', order: 3 },
  { id: 'grp_liver', labelKey: 'group.liver', cluster: 'hepatobiliary', order: 4 },
  { id: 'grp_weight', labelKey: 'group.weight', cluster: 'weight_appetite', order: 5 },
  { id: 'grp_systemic', labelKey: 'group.systemic', cluster: 'systemic', order: 6 },
  { id: 'grp_history', labelKey: 'group.history', cluster: 'history', order: 7 },
  { id: 'grp_meds', labelKey: 'group.meds', cluster: 'medication_lifestyle', order: 8 },
];

/**
 * The patient picks a symptom area, never a disease. Asking "which condition do you think you
 * have?" would both bias the answers and put the patient in the position of self-diagnosing.
 */
export const ENTRY_POINTS: EntryPoint[] = [
  {
    id: 'ep_pain',
    labelKey: 'entry.pain',
    entryGroupId: 'grp_pain',
    seedQuestionIds: ['pain_present'],
    order: 0,
  },
  {
    id: 'ep_bowel',
    labelKey: 'entry.bowel',
    entryGroupId: 'grp_bowel',
    seedQuestionIds: ['bowel_change'],
    order: 1,
  },
  {
    id: 'ep_bleeding',
    labelKey: 'entry.bleeding',
    entryGroupId: 'grp_bleeding',
    seedQuestionIds: ['blood_in_stool'],
    order: 2,
  },
  {
    id: 'ep_reflux',
    labelKey: 'entry.reflux',
    entryGroupId: 'grp_reflux',
    seedQuestionIds: ['heartburn'],
    order: 3,
  },
  {
    id: 'ep_liver',
    labelKey: 'entry.liver',
    entryGroupId: 'grp_liver',
    seedQuestionIds: ['jaundice'],
    order: 4,
  },
];

export const BODY_MAP_REGIONS = [
  'right_upper',
  'epigastrium',
  'left_upper',
  'right_flank',
  'periumbilical',
  'left_flank',
  'right_lower',
  'suprapubic',
  'left_lower',
  'whole_abdomen',
  'back',
] as const;

export const QUESTIONS: Question[] = [
  /* -- Pain ------------------------------------------------------------------------------- */
  q('pain_present', 'grp_pain', 'single_select', 0, { options: yesNo('pain_present') }),
  q('pain_site', 'grp_pain', 'body_map', 1, {
    bodyMapRegionIds: [...BODY_MAP_REGIONS],
    helpKey: 'q.pain_site.help',
    referenceImageIds: ['img_body_map'],
  }),
  q('pain_severity', 'grp_pain', 'scale', 2, {
    scale: { min: 0, max: 10, minLabelKey: 'scale.pain.none', maxLabelKey: 'scale.pain.worst' },
  }),
  q('pain_duration', 'grp_pain', 'duration', 3),
  q('pain_pattern', 'grp_pain', 'single_select', 4, {
    options: opts('pain_pattern', [
      ['constant', 'affirms'],
      ['comes_and_goes', 'affirms'],
      ['worse_after_eating', 'affirms'],
      ['better_after_eating', 'affirms'],
      ['wakes_me_at_night', 'affirms'],
    ]),
  }),
  q('pain_radiates', 'grp_pain', 'multi_select', 5, {
    required: false,
    options: opts('pain_radiates', [
      ['to_back', 'affirms'],
      ['to_shoulder', 'affirms'],
      ['to_groin', 'affirms'],
      ['nowhere', 'denies'],
    ]),
  }),
  q('pain_relief_position', 'grp_pain', 'single_select', 6, {
    required: false,
    options: opts('pain_relief_position', [
      ['leaning_forward', 'affirms'],
      ['lying_still', 'affirms'],
      ['nothing_helps', 'affirms'],
    ]),
  }),
  q('abdomen_rigid', 'grp_pain', 'single_select', 7, {
    helpKey: 'q.abdomen_rigid.help',
    options: yesNo('abdomen_rigid'),
  }),
  q('abdomen_distended', 'grp_pain', 'single_select', 8, { options: yesNo('abdomen_distended') }),
  q('vomiting', 'grp_pain', 'single_select', 9, { options: yesNo('vomiting') }),
  q('vomit_appearance', 'grp_pain', 'single_select', 10, {
    options: opts('vomit_appearance', [
      ['food_only', 'affirms'],
      ['bile_green', 'affirms'],
      ['blood_red', 'affirms', ['img_haematemesis']],
      ['coffee_grounds', 'affirms', ['img_coffee_grounds']],
      ['faeculent', 'affirms'],
    ]),
    referenceImageIds: ['img_vomit_reference'],
  }),
  q('passing_wind_or_stool', 'grp_pain', 'single_select', 11, {
    helpKey: 'q.passing_wind_or_stool.help',
    options: opts('passing_wind_or_stool', [
      ['both_normally', 'denies'],
      ['wind_only', 'affirms'],
      ['neither_for_a_day', 'affirms'],
    ]),
  }),

  /* -- Bowel habit ------------------------------------------------------------------------ */
  q('bowel_change', 'grp_bowel', 'single_select', 0, { options: yesNo('bowel_change') }),
  q('bowel_change_direction', 'grp_bowel', 'multi_select', 1, {
    options: opts('bowel_change_direction', [
      ['looser', 'affirms'],
      ['harder', 'affirms'],
      ['more_often', 'affirms'],
      ['less_often', 'affirms'],
      ['alternating', 'affirms'],
    ]),
  }),
  q('bowel_change_duration', 'grp_bowel', 'duration', 2, { helpKey: 'q.bowel_change_duration.help' }),
  q('stool_form', 'grp_bowel', 'single_select', 3, {
    helpKey: 'q.stool_form.help',
    referenceImageIds: ['img_stool_form_chart'],
    options: opts('stool_form', [
      ['type_1', 'affirms', ['img_stool_type_1']],
      ['type_2', 'affirms', ['img_stool_type_2']],
      ['type_3', 'affirms', ['img_stool_type_3']],
      ['type_4', 'affirms', ['img_stool_type_4']],
      ['type_5', 'affirms', ['img_stool_type_5']],
      ['type_6', 'affirms', ['img_stool_type_6']],
      ['type_7', 'affirms', ['img_stool_type_7']],
    ]),
  }),
  q('stool_frequency', 'grp_bowel', 'numeric', 4, {
    numeric: { min: 0, max: 30, unit: 'times per day', integerOnly: true },
  }),
  q('night_time_stools', 'grp_bowel', 'single_select', 5, { options: yesNo('night_time_stools') }),
  q('mucus_in_stool', 'grp_bowel', 'single_select', 6, { options: yesNo('mucus_in_stool') }),
  q('urgency_incontinence', 'grp_bowel', 'single_select', 7, { options: yesNo('urgency_incontinence') }),
  q('tenesmus', 'grp_bowel', 'single_select', 8, {
    clinicalTerms: [{ term: 'tenesmus', layExplanationKey: 'term.tenesmus.lay' }],
    options: yesNo('tenesmus'),
  }),

  /* -- Bleeding --------------------------------------------------------------------------- */
  q('blood_in_stool', 'grp_bleeding', 'single_select', 0, { options: yesNo('blood_in_stool') }),
  q('blood_appearance', 'grp_bleeding', 'single_select', 1, {
    helpKey: 'q.blood_appearance.help',
    clinicalTerms: [{ term: 'melaena', layExplanationKey: 'term.melaena.lay' }],
    referenceImageIds: ['img_blood_appearance_chart'],
    options: opts('blood_appearance', [
      ['bright_red', 'affirms', ['img_blood_bright_red']],
      ['dark_red', 'affirms', ['img_blood_dark_red']],
      ['black_tarry', 'affirms', ['img_blood_black_tarry']],
    ]),
  }),
  q('blood_position', 'grp_bleeding', 'single_select', 2, {
    referenceImageIds: ['img_blood_position'],
    options: opts('blood_position', [
      ['mixed_in', 'affirms', ['img_blood_mixed']],
      ['coating_surface', 'affirms', ['img_blood_coating']],
      ['on_paper_only', 'affirms'],
      ['in_the_pan_only', 'affirms'],
    ]),
  }),
  q('blood_episodes', 'grp_bleeding', 'numeric', 3, {
    numeric: { min: 0, max: 50, unit: 'episodes in the past 2 weeks', integerOnly: true },
  }),
  q('blood_duration', 'grp_bleeding', 'duration', 4),
  q('anal_symptoms', 'grp_bleeding', 'multi_select', 5, {
    options: opts('anal_symptoms', [
      ['pain_on_passing', 'affirms'],
      ['itching', 'affirms'],
      ['lump', 'affirms'],
      ['none', 'denies'],
    ]),
  }),
  q('vomited_blood', 'grp_bleeding', 'single_select', 6, { options: yesNo('vomited_blood') }),

  /* -- Reflux / upper GI ------------------------------------------------------------------ */
  q('heartburn', 'grp_reflux', 'single_select', 0, { options: yesNo('heartburn') }),
  q('heartburn_frequency', 'grp_reflux', 'single_select', 1, {
    options: opts('heartburn_frequency', [
      ['less_than_weekly', 'affirms'],
      ['weekly', 'affirms'],
      ['most_days', 'affirms'],
      ['daily', 'affirms'],
    ]),
  }),
  q('heartburn_duration', 'grp_reflux', 'duration', 2),
  q('regurgitation', 'grp_reflux', 'single_select', 3, { options: yesNo('regurgitation') }),
  q('swallowing_difficulty', 'grp_reflux', 'single_select', 4, {
    clinicalTerms: [{ term: 'dysphagia', layExplanationKey: 'term.dysphagia.lay' }],
    options: opts('swallowing_difficulty', [
      ['no', 'denies'],
      ['solids_only', 'affirms'],
      ['solids_and_liquids', 'affirms'],
      ['food_sticks', 'affirms'],
    ]),
  }),
  q('swallowing_worsening', 'grp_reflux', 'single_select', 5, { options: yesNo('swallowing_worsening') }),
  q('early_satiety', 'grp_reflux', 'single_select', 6, {
    helpKey: 'q.early_satiety.help',
    options: yesNo('early_satiety'),
  }),

  /* -- Liver ------------------------------------------------------------------------------ */
  q('jaundice', 'grp_liver', 'single_select', 0, {
    helpKey: 'q.jaundice.help',
    referenceImageIds: ['img_jaundice_eyes', 'img_jaundice_skin'],
    options: yesNo('jaundice'),
  }),
  q('urine_colour', 'grp_liver', 'single_select', 1, {
    referenceImageIds: ['img_urine_colour_chart'],
    options: opts('urine_colour', [
      ['pale', 'denies'],
      ['normal_yellow', 'denies'],
      ['dark_amber', 'affirms'],
      ['tea_or_cola', 'affirms'],
    ]),
  }),
  q('stool_colour_pale', 'grp_liver', 'single_select', 2, {
    referenceImageIds: ['img_pale_stool'],
    options: yesNo('stool_colour_pale'),
  }),
  q('itching_skin', 'grp_liver', 'single_select', 3, { options: yesNo('itching_skin') }),
  q('abdominal_swelling', 'grp_liver', 'single_select', 4, {
    clinicalTerms: [{ term: 'ascites', layExplanationKey: 'term.ascites.lay' }],
    options: yesNo('abdominal_swelling'),
  }),
  q('leg_swelling', 'grp_liver', 'single_select', 5, { options: yesNo('leg_swelling') }),
  q('confusion_drowsiness', 'grp_liver', 'single_select', 6, {
    helpKey: 'q.confusion_drowsiness.help',
    options: yesNo('confusion_drowsiness'),
  }),
  q('easy_bruising', 'grp_liver', 'single_select', 7, { options: yesNo('easy_bruising') }),

  /* -- Weight and appetite ---------------------------------------------------------------- */
  q('weight_loss', 'grp_weight', 'single_select', 0, {
    helpKey: 'q.weight_loss.help',
    options: yesNo('weight_loss'),
  }),
  q('weight_loss_kg', 'grp_weight', 'numeric', 1, {
    numeric: { min: 0, max: 60, unit: 'kg', integerOnly: false },
  }),
  q('weight_loss_period', 'grp_weight', 'duration', 2),
  q('appetite_change', 'grp_weight', 'single_select', 3, {
    options: opts('appetite_change', [
      ['unchanged', 'denies'],
      ['reduced', 'affirms'],
      ['increased', 'affirms'],
    ]),
  }),

  /* -- Systemic --------------------------------------------------------------------------- */
  q('lightheaded', 'grp_systemic', 'single_select', 0, { options: yesNo('lightheaded') }),
  q('fainted', 'grp_systemic', 'single_select', 1, { options: yesNo('fainted') }),
  q('fever', 'grp_systemic', 'single_select', 2, { options: yesNo('fever') }),
  q('night_sweats', 'grp_systemic', 'single_select', 3, { options: yesNo('night_sweats') }),
  q('fatigue', 'grp_systemic', 'single_select', 4, { options: yesNo('fatigue') }),
  q('unable_to_keep_fluids_down', 'grp_systemic', 'single_select', 5, {
    options: yesNo('unable_to_keep_fluids_down'),
  }),
  q('passing_much_less_urine', 'grp_systemic', 'single_select', 6, {
    options: yesNo('passing_much_less_urine'),
  }),

  /* -- History ---------------------------------------------------------------------------- */
  q('known_conditions', 'grp_history', 'multi_select', 0, {
    required: false,
    options: opts('known_conditions', [
      ['ibd', 'affirms'],
      ['peptic_ulcer', 'affirms'],
      ['gallstones', 'affirms'],
      ['liver_disease', 'affirms'],
      ['pancreatitis', 'affirms'],
      ['diabetes', 'affirms'],
      ['none', 'denies'],
    ]),
  }),
  q('previous_gi_surgery', 'grp_history', 'single_select', 1, { options: yesNo('previous_gi_surgery') }),
  q('previous_endoscopy', 'grp_history', 'single_select', 2, { options: yesNo('previous_endoscopy') }),
  q('family_gi_cancer', 'grp_history', 'single_select', 3, {
    helpKey: 'q.family_gi_cancer.help',
    options: yesNo('family_gi_cancer'),
  }),
  q('family_ibd', 'grp_history', 'single_select', 4, { options: yesNo('family_ibd') }),
  q('other_history', 'grp_history', 'text', 5, { required: false, textMaxLength: 1500 }),

  /* -- Medication and lifestyle ----------------------------------------------------------- */
  q('painkiller_use', 'grp_meds', 'single_select', 0, {
    helpKey: 'q.painkiller_use.help',
    options: opts('painkiller_use', [
      ['never', 'denies'],
      ['occasionally', 'affirms'],
      ['most_weeks', 'affirms'],
      ['daily', 'affirms'],
    ]),
  }),
  q('acid_medication_use', 'grp_meds', 'single_select', 1, { options: yesNo('acid_medication_use') }),
  q('blood_thinner_use', 'grp_meds', 'single_select', 2, { options: yesNo('blood_thinner_use') }),
  q('alcohol_use', 'grp_meds', 'single_select', 3, {
    options: opts('alcohol_use', [
      ['never', 'denies'],
      ['occasional', 'affirms'],
      ['weekly', 'affirms'],
      ['most_days', 'affirms'],
    ]),
  }),
  q('tobacco_use', 'grp_meds', 'single_select', 4, {
    options: opts('tobacco_use', [
      ['never', 'denies'],
      ['former', 'affirms'],
      ['current_smoking', 'affirms'],
      ['current_chewing', 'affirms'],
    ]),
  }),
  q('recent_travel_or_outside_food', 'grp_meds', 'single_select', 5, {
    options: yesNo('recent_travel_or_outside_food'),
  }),
  q('current_medications', 'grp_meds', 'text', 6, {
    required: false,
    helpKey: 'q.current_medications.help',
    textMaxLength: 1500,
  }),
];

const reveal = (
  id: string,
  when: BranchingRule['when'],
  questionIds: string[],
  groupIds: string[] = [],
): BranchingRule => ({
  id,
  when,
  revealQuestionIds: questionIds,
  revealGroupIds: groupIds,
});

export const RULES: BranchingRule[] = [
  /* -- Pain chain ------------------------------------------------------------------------- */
  reveal('r_pain_yes', { op: 'equals', questionId: 'pain_present', optionId: 'yes' }, [
    'pain_site',
    'pain_severity',
    'pain_duration',
    'pain_pattern',
    'pain_radiates',
    'abdomen_rigid',
    'abdomen_distended',
    'vomiting',
    'weight_loss',
  ]),
  reveal(
    'r_pain_epigastric',
    {
      op: 'all',
      of: [
        { op: 'includes', questionId: 'pain_site', optionId: 'epigastrium' },
        { op: 'answered', questionId: 'pain_pattern' },
      ],
    },
    ['heartburn', 'painkiller_use'],
  ),
  reveal(
    'r_pain_to_back',
    { op: 'includes', questionId: 'pain_radiates', optionId: 'to_back' },
    ['pain_relief_position', 'alcohol_use'],
  ),
  reveal(
    'r_pain_right_upper',
    { op: 'includes', questionId: 'pain_site', optionId: 'right_upper' },
    ['jaundice'],
  ),
  reveal('r_vomiting_yes', { op: 'equals', questionId: 'vomiting', optionId: 'yes' }, [
    'vomit_appearance',
    'unable_to_keep_fluids_down',
  ]),
  reveal(
    'r_vomit_blood',
    {
      op: 'any',
      of: [
        { op: 'equals', questionId: 'vomit_appearance', optionId: 'blood_red' },
        { op: 'equals', questionId: 'vomit_appearance', optionId: 'coffee_grounds' },
      ],
    },
    ['lightheaded', 'blood_thinner_use'],
  ),
  reveal(
    'r_obstruction_screen',
    {
      op: 'all',
      of: [
        { op: 'equals', questionId: 'abdomen_distended', optionId: 'yes' },
        { op: 'equals', questionId: 'vomiting', optionId: 'yes' },
      ],
    },
    ['passing_wind_or_stool'],
  ),

  /* -- Bowel chain ------------------------------------------------------------------------ */
  reveal('r_bowel_changed', { op: 'equals', questionId: 'bowel_change', optionId: 'yes' }, [
    'bowel_change_direction',
    'bowel_change_duration',
    'stool_form',
    'blood_in_stool',
    'weight_loss',
  ]),
  reveal(
    'r_bowel_looser',
    { op: 'includes', questionId: 'bowel_change_direction', optionId: 'looser' },
    [
      'stool_frequency',
      'night_time_stools',
      'mucus_in_stool',
      'urgency_incontinence',
      'fever',
      'family_ibd',
    ],
  ),
  reveal(
    'r_bowel_persistent',
    { op: 'duration_gte', questionId: 'bowel_change_duration', days: 14 },
    ['family_gi_cancer', 'previous_endoscopy'],
  ),
  reveal(
    'r_frequent_stools',
    { op: 'gt', questionId: 'stool_frequency', value: 6 },
    ['unable_to_keep_fluids_down', 'passing_much_less_urine'],
  ),
  reveal('r_mucus', { op: 'equals', questionId: 'mucus_in_stool', optionId: 'yes' }, ['tenesmus']),

  /* -- Bleeding chain (the worked example from the build brief) --------------------------- */
  reveal('r_blood_yes', { op: 'equals', questionId: 'blood_in_stool', optionId: 'yes' }, [
    'blood_appearance',
    'blood_duration',
    'weight_loss',
  ]),
  reveal(
    'r_blood_black_tarry',
    { op: 'equals', questionId: 'blood_appearance', optionId: 'black_tarry' },
    ['lightheaded', 'vomited_blood', 'painkiller_use', 'blood_thinner_use'],
  ),
  reveal('r_lightheaded_yes', { op: 'equals', questionId: 'lightheaded', optionId: 'yes' }, [
    'fainted',
  ]),
  reveal(
    'r_blood_bright_red',
    { op: 'equals', questionId: 'blood_appearance', optionId: 'bright_red' },
    ['blood_position'],
  ),
  // Reveals the descriptive stool-form question rather than the bowel-habit gate: the bowel
  // gate already reveals the bleeding questions, so reaching back to it would close a loop in
  // which each question could only appear once the other had been answered.
  reveal(
    'r_blood_mixed_in',
    { op: 'equals', questionId: 'blood_position', optionId: 'mixed_in' },
    ['blood_episodes', 'stool_form', 'family_gi_cancer'],
  ),
  reveal(
    'r_blood_surface',
    {
      op: 'any',
      of: [
        { op: 'equals', questionId: 'blood_position', optionId: 'coating_surface' },
        { op: 'equals', questionId: 'blood_position', optionId: 'on_paper_only' },
        { op: 'equals', questionId: 'blood_position', optionId: 'in_the_pan_only' },
      ],
    },
    ['anal_symptoms'],
  ),

  /* -- Reflux chain ----------------------------------------------------------------------- */
  reveal('r_heartburn_yes', { op: 'equals', questionId: 'heartburn', optionId: 'yes' }, [
    'heartburn_frequency',
    'heartburn_duration',
    'regurgitation',
    'swallowing_difficulty',
    'acid_medication_use',
    'weight_loss',
  ]),
  reveal(
    'r_dysphagia',
    {
      op: 'any',
      of: [
        { op: 'equals', questionId: 'swallowing_difficulty', optionId: 'solids_only' },
        { op: 'equals', questionId: 'swallowing_difficulty', optionId: 'solids_and_liquids' },
        { op: 'equals', questionId: 'swallowing_difficulty', optionId: 'food_sticks' },
      ],
    },
    ['swallowing_worsening', 'early_satiety', 'vomited_blood'],
  ),
  reveal(
    'r_longstanding_reflux',
    {
      op: 'all',
      of: [
        { op: 'duration_gte', questionId: 'heartburn_duration', days: 1825 },
        { op: 'answered', questionId: 'heartburn_frequency' },
      ],
    },
    ['previous_endoscopy', 'tobacco_use'],
  ),

  /* -- Liver chain ------------------------------------------------------------------------ */
  reveal('r_jaundice_yes', { op: 'equals', questionId: 'jaundice', optionId: 'yes' }, [
    'urine_colour',
    'stool_colour_pale',
    'itching_skin',
    'abdominal_swelling',
    'fever',
    'alcohol_use',
  ]),
  reveal(
    'r_liver_decompensation',
    { op: 'equals', questionId: 'abdominal_swelling', optionId: 'yes' },
    ['leg_swelling', 'confusion_drowsiness', 'easy_bruising', 'vomited_blood'],
  ),
  // Deliberately does NOT reveal a pain question: right-upper-quadrant pain already reveals the
  // jaundice question, and jaundice reveals urine colour, so reaching back to pain here would
  // close a loop that publication validation rejects — and would mean a question could only
  // appear once it had already been answered.
  reveal(
    'r_dark_urine',
    {
      op: 'any',
      of: [
        { op: 'equals', questionId: 'urine_colour', optionId: 'dark_amber' },
        { op: 'equals', questionId: 'urine_colour', optionId: 'tea_or_cola' },
      ],
    },
    ['fever', 'previous_gi_surgery'],
  ),

  /* -- Weight, history, and lifestyle ----------------------------------------------------- */
  reveal('r_weight_loss_yes', { op: 'equals', questionId: 'weight_loss', optionId: 'yes' }, [
    'weight_loss_kg',
    'weight_loss_period',
    'appetite_change',
    'fatigue',
    'night_sweats',
  ]),
  reveal(
    'r_significant_weight_loss',
    { op: 'gt', questionId: 'weight_loss_kg', value: 4 },
    ['family_gi_cancer', 'known_conditions', 'previous_gi_surgery'],
  ),
  reveal(
    'r_fever_yes',
    { op: 'equals', questionId: 'fever', optionId: 'yes' },
    ['recent_travel_or_outside_food'],
  ),
  reveal(
    'r_context_always',
    { op: 'answered', questionId: 'known_conditions' },
    ['current_medications', 'other_history'],
  ),
  reveal(
    'r_history_entry',
    {
      op: 'any',
      of: [
        { op: 'answered', questionId: 'weight_loss' },
        { op: 'answered', questionId: 'blood_in_stool' },
        { op: 'answered', questionId: 'jaundice' },
        { op: 'answered', questionId: 'heartburn' },
      ],
    },
    ['known_conditions'],
  ),
];
