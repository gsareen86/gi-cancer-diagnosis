import type { TemplateVersion } from '../questionnaire/template.js';
import type { RedFlagRuleSet } from '../safety/red-flags.js';

/**
 * The worked GI triage example from the build brief, expressed entirely as data.
 *
 *   "Have you noticed blood when you pass stool?"
 *     → "What does the blood look like?"        [reference images]
 *        → black and tarry  → "Any lightheadedness, weakness, or fainting?"   [red flag]
 *        → bright red       → "Mixed into the stool, or coating / separate?"
 *            → mixed        → "More than 3 times in the past 2 weeks?"
 *            → coats        → "Pain, itching, or a lump near the anus?"
 *     → "How long has this been happening?"
 *     → "Any unintentional weight loss?"        [red-flag contributor]
 *
 * Five hops deep, which is what a real GI intake looks like and what the engine has to keep
 * contiguous rather than scattering back into group order.
 */
export const bleedingTemplate: TemplateVersion = {
  templateId: 'gi-intake',
  version: 1,
  status: 'published',
  approvedLocales: ['en', 'hi'],
  entryPoints: [
    {
      id: 'ep_bleeding',
      labelKey: 'entry.bleeding',
      entryGroupId: 'grp_bleeding',
      seedQuestionIds: ['q_blood'],
      order: 0,
    },
    {
      id: 'ep_bowel',
      labelKey: 'entry.bowel',
      entryGroupId: 'grp_bowel',
      seedQuestionIds: ['q_bowel_change'],
      order: 1,
    },
  ],
  groups: [
    { id: 'grp_bleeding', labelKey: 'group.bleeding', cluster: 'bleeding', order: 0 },
    { id: 'grp_bowel', labelKey: 'group.bowel', cluster: 'bowel_habit', order: 1 },
    { id: 'grp_systemic', labelKey: 'group.systemic', cluster: 'systemic', order: 2 },
    { id: 'grp_weight', labelKey: 'group.weight', cluster: 'weight_appetite', order: 3 },
  ],
  questions: [
    {
      id: 'q_blood',
      groupId: 'grp_bleeding',
      type: 'single_select',
      promptKey: 'q.blood.prompt',
      clinicalTerms: [],
      options: [
        { id: 'yes', labelKey: 'opt.yes', order: 0, referenceImageIds: [], polarity: 'affirms' },
        { id: 'no', labelKey: 'opt.no', order: 1, referenceImageIds: [], polarity: 'denies' },
        { id: 'unsure', labelKey: 'opt.unsure', order: 2, referenceImageIds: [], polarity: 'indeterminate' },
      ],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 0,
      textMaxLength: 2000,
    },
    {
      id: 'q_blood_appearance',
      groupId: 'grp_bleeding',
      type: 'single_select',
      promptKey: 'q.blood_appearance.prompt',
      helpKey: 'q.blood_appearance.help',
      clinicalTerms: [{ term: 'melaena', layExplanationKey: 'term.melaena.lay' }],
      options: [
        { id: 'bright_red', labelKey: 'opt.bright_red', order: 0, referenceImageIds: ['img_bright_red'], polarity: 'affirms' },
        { id: 'dark_red', labelKey: 'opt.dark_red', order: 1, referenceImageIds: ['img_dark_red'], polarity: 'affirms' },
        { id: 'black_tarry', labelKey: 'opt.black_tarry', order: 2, referenceImageIds: ['img_black_tarry'], polarity: 'affirms' },
      ],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 1,
      textMaxLength: 2000,
    },
    {
      id: 'q_lightheaded',
      groupId: 'grp_systemic',
      type: 'single_select',
      promptKey: 'q.lightheaded.prompt',
      clinicalTerms: [],
      options: [
        { id: 'yes', labelKey: 'opt.yes', order: 0, referenceImageIds: [], polarity: 'affirms' },
        { id: 'no', labelKey: 'opt.no', order: 1, referenceImageIds: [], polarity: 'denies' },
      ],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 0,
      textMaxLength: 2000,
    },
    {
      id: 'q_fainting',
      groupId: 'grp_systemic',
      type: 'single_select',
      promptKey: 'q.fainting.prompt',
      clinicalTerms: [],
      options: [
        { id: 'yes', labelKey: 'opt.yes', order: 0, referenceImageIds: [], polarity: 'affirms' },
        { id: 'no', labelKey: 'opt.no', order: 1, referenceImageIds: [], polarity: 'denies' },
      ],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 1,
      textMaxLength: 2000,
    },
    {
      id: 'q_blood_position',
      groupId: 'grp_bleeding',
      type: 'single_select',
      promptKey: 'q.blood_position.prompt',
      clinicalTerms: [],
      options: [
        { id: 'mixed_in', labelKey: 'opt.mixed_in', order: 0, referenceImageIds: ['img_mixed'], polarity: 'affirms' },
        { id: 'coats_separate', labelKey: 'opt.coats_separate', order: 1, referenceImageIds: ['img_coating'], polarity: 'affirms' },
      ],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 2,
      textMaxLength: 2000,
    },
    {
      id: 'q_blood_frequency',
      groupId: 'grp_bleeding',
      type: 'numeric',
      promptKey: 'q.blood_frequency.prompt',
      clinicalTerms: [],
      options: [],
      numeric: { min: 0, max: 20, unit: 'episodes in the past 2 weeks', integerOnly: true },
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 3,
      textMaxLength: 2000,
    },
    {
      id: 'q_anal_symptoms',
      groupId: 'grp_bleeding',
      type: 'multi_select',
      promptKey: 'q.anal_symptoms.prompt',
      clinicalTerms: [],
      options: [
        { id: 'pain', labelKey: 'opt.pain', order: 0, referenceImageIds: [], polarity: 'affirms' },
        { id: 'itching', labelKey: 'opt.itching', order: 1, referenceImageIds: [], polarity: 'affirms' },
        { id: 'lump', labelKey: 'opt.lump', order: 2, referenceImageIds: [], polarity: 'affirms' },
        { id: 'none', labelKey: 'opt.none', order: 3, referenceImageIds: [], polarity: 'denies' },
      ],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 4,
      textMaxLength: 2000,
    },
    {
      id: 'q_blood_duration',
      groupId: 'grp_bleeding',
      type: 'duration',
      promptKey: 'q.blood_duration.prompt',
      clinicalTerms: [],
      options: [],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 5,
      textMaxLength: 2000,
    },
    {
      id: 'q_weight_loss',
      groupId: 'grp_weight',
      type: 'single_select',
      promptKey: 'q.weight_loss.prompt',
      clinicalTerms: [],
      options: [
        { id: 'yes', labelKey: 'opt.yes', order: 0, referenceImageIds: [], polarity: 'affirms' },
        { id: 'no', labelKey: 'opt.no', order: 1, referenceImageIds: [], polarity: 'denies' },
      ],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 0,
      textMaxLength: 2000,
    },
    {
      id: 'q_bowel_change',
      groupId: 'grp_bowel',
      type: 'single_select',
      promptKey: 'q.bowel_change.prompt',
      clinicalTerms: [],
      options: [
        { id: 'yes', labelKey: 'opt.yes', order: 0, referenceImageIds: [], polarity: 'affirms' },
        { id: 'no', labelKey: 'opt.no', order: 1, referenceImageIds: [], polarity: 'denies' },
      ],
      bodyMapRegionIds: [],
      referenceImageIds: [],
      required: true,
      order: 0,
      textMaxLength: 2000,
    },
  ],
  rules: [
    {
      id: 'r_blood_yes',
      when: { op: 'equals', questionId: 'q_blood', optionId: 'yes' },
      revealQuestionIds: ['q_blood_appearance', 'q_blood_duration', 'q_weight_loss'],
      revealGroupIds: [],
    },
    {
      id: 'r_black_tarry',
      when: { op: 'equals', questionId: 'q_blood_appearance', optionId: 'black_tarry' },
      revealQuestionIds: ['q_lightheaded'],
      revealGroupIds: [],
    },
    {
      id: 'r_lightheaded_yes',
      when: { op: 'equals', questionId: 'q_lightheaded', optionId: 'yes' },
      revealQuestionIds: ['q_fainting'],
      revealGroupIds: [],
    },
    {
      id: 'r_bright_red',
      when: { op: 'equals', questionId: 'q_blood_appearance', optionId: 'bright_red' },
      revealQuestionIds: ['q_blood_position'],
      revealGroupIds: [],
    },
    {
      id: 'r_mixed_in',
      when: { op: 'equals', questionId: 'q_blood_position', optionId: 'mixed_in' },
      revealQuestionIds: ['q_blood_frequency'],
      revealGroupIds: [],
    },
    {
      id: 'r_coats_separate',
      when: { op: 'equals', questionId: 'q_blood_position', optionId: 'coats_separate' },
      revealQuestionIds: ['q_anal_symptoms'],
      revealGroupIds: [],
    },
  ],
};

export const bleedingRedFlags: RedFlagRuleSet = {
  version: 3,
  rules: [
    {
      id: 'rf_upper_gi_bleed_with_hypovolaemia',
      basisKey: 'redflag.upper_gi_bleed_with_hypovolaemia.basis',
      urgency: 'emergency',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'q_blood_appearance', optionId: 'black_tarry' },
          {
            op: 'any',
            of: [
              { op: 'equals', questionId: 'q_lightheaded', optionId: 'yes' },
              { op: 'equals', questionId: 'q_fainting', optionId: 'yes' },
            ],
          },
        ],
      },
    },
    {
      id: 'rf_frequent_mixed_bleeding',
      basisKey: 'redflag.frequent_mixed_bleeding.basis',
      urgency: 'urgent',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'q_blood_position', optionId: 'mixed_in' },
          { op: 'gt', questionId: 'q_blood_frequency', value: 3 },
        ],
      },
    },
    {
      id: 'rf_bleeding_with_weight_loss_over_45',
      basisKey: 'redflag.bleeding_with_weight_loss_over_45.basis',
      urgency: 'urgent',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'q_blood', optionId: 'yes' },
          { op: 'equals', questionId: 'q_weight_loss', optionId: 'yes' },
          { op: 'age_gte', years: 45 },
        ],
      },
    },
    {
      id: 'rf_prolonged_bleeding',
      basisKey: 'redflag.prolonged_bleeding.basis',
      urgency: 'routine-but-flagged',
      when: { op: 'duration_gte', questionId: 'q_blood_duration', days: 14 },
    },
  ],
};

/** The English catalogue the summary compiler resolves keys through in tests. */
export const englishCatalogue: Record<string, string> = {
  'q.blood.prompt': 'Have you noticed blood when you pass stool?',
  'q.blood_appearance.prompt': 'What does the blood look like?',
  'q.blood_position.prompt': 'Is the blood mixed into the stool, or does it coat the outside?',
  'q.blood_frequency.prompt': 'How many times has this happened in the past 2 weeks?',
  'q.anal_symptoms.prompt': 'Do you have pain, itching, or a lump near the anus?',
  'q.blood_duration.prompt': 'How long has this been happening?',
  'q.lightheaded.prompt': 'Have you also had lightheadedness or weakness?',
  'q.fainting.prompt': 'Have you fainted?',
  'q.weight_loss.prompt': 'Have you lost weight without trying to?',
  'q.bowel_change.prompt': 'Have your bowel habits changed?',
  'opt.yes': 'Yes',
  'opt.no': 'No',
  'opt.unsure': 'Not sure',
  'opt.bright_red': 'Bright red',
  'opt.dark_red': 'Dark red',
  'opt.black_tarry': 'Black and tarry',
  'opt.mixed_in': 'Mixed into the stool',
  'opt.coats_separate': 'Coating the outside or separate',
  'opt.pain': 'Pain',
  'opt.itching': 'Itching',
  'opt.lump': 'A lump',
  'opt.none': 'None of these',
  'redflag.upper_gi_bleed_with_hypovolaemia.basis':
    'Your answers describe a pattern that needs urgent in-person care today.',
  'redflag.frequent_mixed_bleeding.basis':
    'Repeated bleeding of this kind needs to be looked at by a specialist soon.',
  'redflag.bleeding_with_weight_loss_over_45.basis':
    'This combination of answers needs a specialist assessment soon.',
  'redflag.prolonged_bleeding.basis': 'This has been going on long enough to need review.',
};

export const resolveEnglish = (key: string): string => englishCatalogue[key] ?? key;
