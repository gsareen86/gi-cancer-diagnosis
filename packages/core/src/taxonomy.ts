import { z } from 'zod';

/**
 * The disease taxonomy is explicit and reviewable, never implied by prompt text
 * (spec: assessment/knowledge-base). It bounds what the model is allowed to name: a
 * differential condition outside this list is a validation failure, not a novel insight.
 *
 * Malignancy is deliberately a single urgent-referral category. The model is not asked to
 * differentiate GI cancer subtypes; that is a specialist's job after imaging and histology.
 *
 * TODO(confirm): Decision C — the Phase 1 taxonomy and its priority order await sign-off
 * from the clinical co-founder.
 */

export const symptomClusterSchema = z.enum([
  'bowel_habit',
  'bleeding',
  'pain',
  'weight_appetite',
  'hepatobiliary',
  'reflux_upper_gi',
  'history',
  'medication_lifestyle',
  'systemic',
]);
export type SymptomCluster = z.infer<typeof symptomClusterSchema>;

export const taxonomyEntrySchema = z.object({
  id: z.string().min(1),
  /** Clinical display name used verbatim in the differential list. */
  label: z.string().min(1),
  clusters: z.array(symptomClusterSchema).min(1),
  /**
   * True for the single malignancy category. Marked entries carry an implicit urgent
   * specialist-referral posture and are never subdivided.
   */
  urgentReferralOnly: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type TaxonomyEntry = z.infer<typeof taxonomyEntrySchema>;

export const PHASE_1_TAXONOMY: readonly TaxonomyEntry[] = [
  {
    id: 'crohns_disease',
    label: "Crohn's disease",
    clusters: ['bowel_habit', 'pain', 'weight_appetite', 'systemic'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'ulcerative_colitis',
    label: 'Ulcerative colitis',
    clusters: ['bowel_habit', 'bleeding', 'systemic'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'peptic_ulcer_disease',
    label: 'Peptic ulcer disease',
    clusters: ['pain', 'reflux_upper_gi', 'bleeding'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'gerd',
    label: 'Gastro-oesophageal reflux disease',
    clusters: ['reflux_upper_gi'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'barretts_oesophagus',
    label: "Barrett's oesophagus (GERD complication)",
    clusters: ['reflux_upper_gi'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'diverticular_disease',
    label: 'Diverticular disease',
    clusters: ['pain', 'bowel_habit', 'bleeding'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'pancreatitis',
    label: 'Pancreatitis',
    clusters: ['pain', 'systemic'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'chronic_liver_disease',
    label: 'Chronic liver disease including cirrhosis',
    clusters: ['hepatobiliary', 'systemic'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'gallstone_biliary_disease',
    label: 'Gallstone / biliary disease',
    clusters: ['hepatobiliary', 'pain'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'infective_gastroenteritis',
    label: 'Infective gastroenteritis',
    clusters: ['bowel_habit', 'systemic'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'irritable_bowel_syndrome',
    label: 'Irritable bowel syndrome',
    clusters: ['bowel_habit', 'pain'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'haemorrhoids_anal_fissure',
    label: 'Haemorrhoids or anal fissure',
    clusters: ['bleeding', 'pain'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'coeliac_disease',
    label: 'Coeliac disease',
    clusters: ['bowel_habit', 'weight_appetite'],
    urgentReferralOnly: false,
    active: true,
  },
  {
    id: 'suspected_gi_malignancy',
    label: 'Features that require urgent specialist review to exclude GI malignancy',
    clusters: ['bleeding', 'weight_appetite', 'bowel_habit', 'reflux_upper_gi', 'hepatobiliary'],
    urgentReferralOnly: true,
    active: true,
  },
] as const;

/** Terms that must never appear in patient-facing red-flag copy (spec: safety/red-flag-triage). */
export const CONDITION_NAMING_TERMS: readonly string[] = [
  ...PHASE_1_TAXONOMY.map((entry) => entry.label),
  'cancer',
  'carcinoma',
  'malignancy',
  'malignant',
  'tumour',
  'tumor',
  'perforation',
  'perforated',
  'obstruction',
  'ulcer',
  'crohn',
  'colitis',
  'cirrhosis',
  'pancreatitis',
  'diverticulitis',
  'hepatitis',
];

export function activeConditionIds(taxonomy: readonly TaxonomyEntry[] = PHASE_1_TAXONOMY): string[] {
  return taxonomy.filter((entry) => entry.active).map((entry) => entry.id);
}
