import type { RedFlagRuleSet } from '@gi-compass/core';

/**
 * Clinician-authored emergency rules, evaluated deterministically on every answer before the AI
 * pipeline is involved at all.
 *
 * Every `basisKey` resolves to copy that describes the *pattern of answers* and the need for
 * urgent in-person care. None of them names a condition — publication validation refuses copy
 * that does, and `validateEscalationCopy` in core is the check.
 *
 * TODO(confirm): every rule and threshold below awaits clinical sign-off. These are a starting
 * point drawn from the build brief's warning signs, not a validated triage instrument.
 */
export const RED_FLAG_RULES: RedFlagRuleSet = {
  version: 1,
  rules: [
    /* -- Emergency -------------------------------------------------------------------------- */
    {
      id: 'rf_upper_gi_bleed_with_hypovolaemia',
      basisKey: 'redflag.upper_gi_bleed_with_hypovolaemia',
      urgency: 'emergency',
      when: {
        op: 'all',
        of: [
          {
            op: 'any',
            of: [
              { op: 'equals', questionId: 'blood_appearance', optionId: 'black_tarry' },
              { op: 'equals', questionId: 'vomited_blood', optionId: 'yes' },
              { op: 'equals', questionId: 'vomit_appearance', optionId: 'blood_red' },
              { op: 'equals', questionId: 'vomit_appearance', optionId: 'coffee_grounds' },
            ],
          },
          {
            op: 'any',
            of: [
              { op: 'equals', questionId: 'lightheaded', optionId: 'yes' },
              { op: 'equals', questionId: 'fainted', optionId: 'yes' },
            ],
          },
        ],
      },
    },
    {
      id: 'rf_possible_perforation',
      basisKey: 'redflag.possible_perforation',
      urgency: 'emergency',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'abdomen_rigid', optionId: 'yes' },
          { op: 'gt', questionId: 'pain_severity', value: 6 },
        ],
      },
    },
    {
      id: 'rf_possible_obstruction',
      basisKey: 'redflag.possible_obstruction',
      urgency: 'emergency',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'abdomen_distended', optionId: 'yes' },
          { op: 'equals', questionId: 'vomiting', optionId: 'yes' },
          { op: 'equals', questionId: 'passing_wind_or_stool', optionId: 'neither_for_a_day' },
        ],
      },
    },
    {
      id: 'rf_severe_dehydration',
      basisKey: 'redflag.severe_dehydration',
      urgency: 'emergency',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'unable_to_keep_fluids_down', optionId: 'yes' },
          {
            op: 'any',
            of: [
              { op: 'equals', questionId: 'passing_much_less_urine', optionId: 'yes' },
              { op: 'equals', questionId: 'lightheaded', optionId: 'yes' },
            ],
          },
        ],
      },
    },
    {
      id: 'rf_hepatic_decompensation',
      basisKey: 'redflag.hepatic_decompensation',
      urgency: 'emergency',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'jaundice', optionId: 'yes' },
          {
            op: 'any',
            of: [
              { op: 'equals', questionId: 'confusion_drowsiness', optionId: 'yes' },
              { op: 'equals', questionId: 'vomited_blood', optionId: 'yes' },
            ],
          },
        ],
      },
    },
    {
      id: 'rf_biliary_sepsis',
      basisKey: 'redflag.biliary_sepsis',
      urgency: 'emergency',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'jaundice', optionId: 'yes' },
          { op: 'equals', questionId: 'fever', optionId: 'yes' },
          { op: 'includes', questionId: 'pain_site', optionId: 'right_upper' },
        ],
      },
    },

    /* -- Urgent ----------------------------------------------------------------------------- */
    {
      id: 'rf_progressive_dysphagia',
      basisKey: 'redflag.progressive_dysphagia',
      urgency: 'urgent',
      when: {
        op: 'all',
        of: [
          {
            op: 'any',
            of: [
              { op: 'equals', questionId: 'swallowing_difficulty', optionId: 'solids_and_liquids' },
              { op: 'equals', questionId: 'swallowing_difficulty', optionId: 'food_sticks' },
            ],
          },
          { op: 'equals', questionId: 'swallowing_worsening', optionId: 'yes' },
        ],
      },
    },
    {
      id: 'rf_bleeding_with_weight_loss_over_45',
      basisKey: 'redflag.bleeding_with_weight_loss_over_45',
      urgency: 'urgent',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'blood_in_stool', optionId: 'yes' },
          { op: 'equals', questionId: 'weight_loss', optionId: 'yes' },
          { op: 'age_gte', years: 45 },
        ],
      },
    },
    {
      id: 'rf_persistent_bowel_change_over_45',
      basisKey: 'redflag.persistent_bowel_change_over_45',
      urgency: 'urgent',
      when: {
        op: 'all',
        of: [
          { op: 'duration_gte', questionId: 'bowel_change_duration', days: 42 },
          { op: 'age_gte', years: 45 },
        ],
      },
    },
    {
      id: 'rf_substantial_unintentional_weight_loss',
      basisKey: 'redflag.substantial_unintentional_weight_loss',
      urgency: 'urgent',
      when: {
        op: 'all',
        of: [
          { op: 'gt', questionId: 'weight_loss_kg', value: 5 },
          { op: 'duration_gte', questionId: 'weight_loss_period', days: 1 },
        ],
      },
    },
    {
      id: 'rf_frequent_mixed_bleeding',
      basisKey: 'redflag.frequent_mixed_bleeding',
      urgency: 'urgent',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'blood_position', optionId: 'mixed_in' },
          { op: 'gt', questionId: 'blood_episodes', value: 3 },
        ],
      },
    },
    {
      id: 'rf_bloody_diarrhoea_with_fever',
      basisKey: 'redflag.bloody_diarrhoea_with_fever',
      urgency: 'urgent',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'blood_in_stool', optionId: 'yes' },
          { op: 'gt', questionId: 'stool_frequency', value: 5 },
          { op: 'equals', questionId: 'fever', optionId: 'yes' },
        ],
      },
    },
    {
      id: 'rf_new_jaundice',
      basisKey: 'redflag.new_jaundice',
      urgency: 'urgent',
      when: { op: 'equals', questionId: 'jaundice', optionId: 'yes' },
    },

    /* -- Routine but flagged ---------------------------------------------------------------- */
    {
      id: 'rf_prolonged_bleeding',
      basisKey: 'redflag.prolonged_bleeding',
      urgency: 'routine-but-flagged',
      when: { op: 'duration_gte', questionId: 'blood_duration', days: 14 },
    },
    {
      id: 'rf_night_time_symptoms',
      basisKey: 'redflag.night_time_symptoms',
      urgency: 'routine-but-flagged',
      when: { op: 'equals', questionId: 'night_time_stools', optionId: 'yes' },
    },
    {
      id: 'rf_longstanding_reflux',
      basisKey: 'redflag.longstanding_reflux',
      urgency: 'routine-but-flagged',
      when: {
        op: 'all',
        of: [
          { op: 'duration_gte', questionId: 'heartburn_duration', days: 1825 },
          { op: 'equals', questionId: 'heartburn_frequency', optionId: 'daily' },
        ],
      },
    },
    {
      id: 'rf_family_history_with_symptoms',
      basisKey: 'redflag.family_history_with_symptoms',
      urgency: 'routine-but-flagged',
      when: {
        op: 'all',
        of: [
          { op: 'equals', questionId: 'family_gi_cancer', optionId: 'yes' },
          {
            op: 'any',
            of: [
              { op: 'equals', questionId: 'blood_in_stool', optionId: 'yes' },
              { op: 'equals', questionId: 'weight_loss', optionId: 'yes' },
              { op: 'equals', questionId: 'bowel_change', optionId: 'yes' },
            ],
          },
        ],
      },
    },
  ],
};
