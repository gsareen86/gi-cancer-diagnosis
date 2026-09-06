import { PHASE_1_TAXONOMY } from '@gi-compass/core';

/** Queue facets, not diagnoses. Match only the existing, validated taxonomy. */
export const CLINICAL_CATEGORIES = ['ibd', 'upper_gi', 'gi_bleed', 'colorectal', 'other'] as const;
export type ClinicalCategory = typeof CLINICAL_CATEGORIES[number];
const CATEGORY: Record<string, ClinicalCategory> = {
  crohns_disease: 'ibd', ulcerative_colitis: 'ibd', gerd: 'upper_gi', barretts_oesophagus: 'upper_gi',
  peptic_ulcer_disease: 'upper_gi', haemorrhoids_anal_fissure: 'gi_bleed',
  diverticular_disease: 'colorectal', suspected_gi_malignancy: 'colorectal',
};
export function clinicalCategories(conditions: string[], entryPointId: string): ClinicalCategory[] {
  const categories = new Set<ClinicalCategory>();
  for (const condition of conditions) {
    const entry = PHASE_1_TAXONOMY.find((item) => item.id === condition || item.label === condition);
    if (entry && CATEGORY[entry.id]) categories.add(CATEGORY[entry.id]!);
  }
  if (entryPointId === 'ep_bleeding') categories.add('gi_bleed');
  if (entryPointId === 'ep_reflux') categories.add('upper_gi');
  return categories.size ? [...categories] : ['other'];
}
