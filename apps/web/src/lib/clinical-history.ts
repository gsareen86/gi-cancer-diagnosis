import { z } from 'zod';

/**
 * The clinical-history vocabulary.
 *
 * Coded where a code is useful and free text where it is not. A closed list makes the common
 * cases analysable — how many reflux presentations are on long-term NSAIDs — while `other` plus
 * a label means an uncommon answer is recorded rather than refused. Refusing it would be worse
 * than useless: the patient would leave the field blank and the doctor would read that as an
 * absence.
 *
 * Codes are identifiers, never display text. The interface resolves each one through the message
 * catalogue, so a Hindi-speaking patient picks from a Hindi list and the reviewing doctor reads
 * the same selection in English.
 *
 * Shared by the intake wizard, the API's validation, and the doctor's record panel, so all three
 * cannot disagree about what a valid entry is.
 */

export const CONDITION_CODES = [
  'ibd_crohn',
  'ibd_uc',
  'gerd',
  'peptic_ulcer',
  'celiac',
  'ibs',
  'chronic_liver_disease',
  'hepatitis_b',
  'hepatitis_c',
  'pancreatitis',
  'gallstones',
  'colorectal_polyps',
  'gi_cancer',
  'diabetes',
  'hypertension',
  'ischaemic_heart_disease',
  'chronic_kidney_disease',
  'thyroid_disorder',
  'anaemia',
  'tuberculosis',
  'other',
] as const;

export const SURGERY_CODES = [
  'appendicectomy',
  'cholecystectomy',
  'hernia_repair',
  'bowel_resection',
  'gastrectomy',
  'bariatric',
  'liver_surgery',
  'endoscopic_polypectomy',
  'caesarean',
  'other',
] as const;

export const FAMILY_RELATIONS = ['parent', 'sibling', 'child', 'grandparent', 'other'] as const;

export const FAMILY_CONDITION_CODES = [
  'colorectal_cancer',
  'gastric_cancer',
  'oesophageal_cancer',
  'liver_cancer',
  'pancreatic_cancer',
  'ibd',
  'celiac',
  'colorectal_polyps',
  'other',
] as const;

export const SMOKING_STATUSES = ['unknown', 'never', 'former', 'current'] as const;
export const ALCOHOL_STATUSES = ['unknown', 'never', 'occasional', 'weekly', 'daily'] as const;
export const DIET_TYPES = ['vegetarian', 'non_vegetarian', 'vegan', 'other'] as const;

/**
 * Prescription versus over-the-counter, kept as a first-class field.
 *
 * It is the distinction that changes how an upper-GI history reads: unsupervised NSAID use is a
 * different clinical picture from the same drug on a prescription with a proton-pump inhibitor
 * alongside it, and a patient will often not mention the first unless asked.
 */
export const MEDICATION_KINDS = ['prescription', 'otc'] as const;

const YEAR_MIN = 1900;

export const conditionEntry = z.object({
  code: z.enum(CONDITION_CODES),
  /** Required when the code is `other`; otherwise the catalogue supplies the display text. */
  label: z.string().max(200).optional(),
  sinceYear: z.number().int().min(YEAR_MIN).max(2200).optional(),
  notes: z.string().max(500).optional(),
});

export const surgeryEntry = z.object({
  code: z.enum(SURGERY_CODES),
  label: z.string().max(200).optional(),
  year: z.number().int().min(YEAR_MIN).max(2200).optional(),
  notes: z.string().max(500).optional(),
});

export const medicationEntry = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(MEDICATION_KINDS),
  frequency: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const allergyEntry = z.object({
  substance: z.string().min(1).max(200),
  reaction: z.string().max(300).optional(),
});

export const familyHistoryEntry = z.object({
  relation: z.enum(FAMILY_RELATIONS),
  condition: z.enum(FAMILY_CONDITION_CODES),
  label: z.string().max(200).optional(),
  ageAtDiagnosis: z.number().int().min(0).max(120).optional(),
});

export const lifestyle = z.object({
  smoking: z.enum(SMOKING_STATUSES),
  alcohol: z.enum(ALCOHOL_STATUSES),
  diet: z.enum(DIET_TYPES).optional(),
});

export const clinicalHistoryInput = z.object({
  trajectory: z.object({
    onset: z.string().max(300).default(''),
    course: z.enum(['unknown', 'improving', 'unchanged', 'worsening', 'comes_and_goes']).default('unknown'),
    impact: z.string().max(1000).default(''),
    remedies: z.string().max(1000).default(''),
    response: z.string().max(1000).default(''),
    previousConsultations: z.string().max(1000).default(''),
  }).nullable().default(null),
  assertions: z.record(z.enum(['conditions', 'surgeries', 'medications', 'allergies', 'familyHistory']), z.enum(['none', 'unknown', 'provided'])).default({}),
  /** Centimetres and kilograms. Both nullable; BMI simply is not shown without both. */
  heightCm: z.number().int().min(50).max(260).nullable(),
  weightKg: z.number().min(10).max(400).nullable(),
  conditions: z.array(conditionEntry).max(30).default([]),
  surgeries: z.array(surgeryEntry).max(20).default([]),
  medications: z.array(medicationEntry).max(40).default([]),
  allergies: z.array(allergyEntry).max(20).default([]),
  familyHistory: z.array(familyHistoryEntry).max(20).default([]),
  lifestyle: lifestyle.nullable().default(null),
  additionalNotes: z.string().max(2000).nullable().default(null),
  lastMenstrualPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  /** False while the patient is still filling the step in; true when they finish it. */
  complete: z.boolean().default(false),
});

export type ConditionEntry = z.infer<typeof conditionEntry>;
export type SurgeryEntry = z.infer<typeof surgeryEntry>;
export type MedicationEntry = z.infer<typeof medicationEntry>;
export type AllergyEntry = z.infer<typeof allergyEntry>;
export type FamilyHistoryEntry = z.infer<typeof familyHistoryEntry>;
export type Lifestyle = z.infer<typeof lifestyle>;
export type ClinicalHistoryInput = z.infer<typeof clinicalHistoryInput>;

/** What the API returns. `weightKg` arrives as a string because the column is `numeric`. */
export interface ClinicalHistoryView {
  trajectory?: ClinicalHistoryInput['trajectory'];
  assertions?: ClinicalHistoryInput['assertions'];
  heightCm: number | null;
  weightKg: string | null;
  conditions: ConditionEntry[];
  surgeries: SurgeryEntry[];
  medications: MedicationEntry[];
  allergies: AllergyEntry[];
  familyHistory: FamilyHistoryEntry[];
  lifestyle: Lifestyle | null;
  additionalNotes: string | null;
  lastMenstrualPeriod: string | null;
  completedAt: string | null;
}

/**
 * Body mass index, computed at the moment of display.
 *
 * Never stored: a persisted BMI can disagree with the height and weight printed beside it, and
 * the version a clinician would then trust is the one that is wrong.
 *
 * Returns null unless both measurements exist, so a partial record shows the measurement that is
 * missing rather than a number derived from a guess.
 */
export function bodyMassIndex(
  heightCm: number | null | undefined,
  weightKg: number | string | null | undefined,
): number | null {
  if (heightCm == null || !Number.isFinite(heightCm) || heightCm < 50 || heightCm > 260) return null;
  const weight = typeof weightKg === 'string' ? Number.parseFloat(weightKg) : weightKg;
  if (weight == null || !Number.isFinite(weight) || weight < 10 || weight > 400) return null;

  const metres = heightCm / 100;
  return Math.round((weight / (metres * metres)) * 10) / 10;
}

export type BmiBand = 'underweight' | 'normal' | 'overweight' | 'obese';

/**
 * WHO Asian-Pacific cut-offs (18.5 / 23 / 25) rather than the international ones (18.5 / 25 / 30).
 *
 * This platform serves patients in India, where metabolic risk rises at a lower BMI, and the
 * international bands would read a genuinely at-risk patient as normal. The band is advisory
 * context beside the number, never a finding on its own.
 */
export function bmiBand(bmi: number): BmiBand {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 23) return 'normal';
  if (bmi < 25) return 'overweight';
  return 'obese';
}
