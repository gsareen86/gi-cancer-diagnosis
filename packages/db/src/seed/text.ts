import { CLINICAL_TEXT_EN } from './text.en';
import { CLINICAL_TEXT_HI, COMMON_OPTION_TEXT_HI } from './text.hi';
import { ENTRY_POINTS, GROUPS, QUESTIONS } from './questions';
import { RED_FLAG_RULES } from './red-flags';

/**
 * Assembles the per-locale clinical text catalogue and proves it is complete.
 *
 * The shared yes / no / not-sure labels are filled in for every question that uses them rather
 * than being authored 60 times, but every other string is written by hand: a question's wording
 * is clinical content, and a template that silently falls back to a raw key would put an
 * untranslated identifier in front of a patient.
 */

const COMMON_OPTION_TEXT_EN: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Not sure',
};

/** Every catalogue key the seeded content resolves at render time. */
export function requiredTextKeys(): string[] {
  const keys = new Set<string>();
  for (const entry of ENTRY_POINTS) keys.add(entry.labelKey);
  for (const group of GROUPS) keys.add(group.labelKey);
  for (const question of QUESTIONS) {
    keys.add(question.promptKey);
    if (question.helpKey !== undefined) keys.add(question.helpKey);
    for (const term of question.clinicalTerms) keys.add(term.layExplanationKey);
    for (const option of question.options) keys.add(option.labelKey);
    if (question.scale) {
      keys.add(question.scale.minLabelKey);
      keys.add(question.scale.maxLabelKey);
    }
  }
  for (const rule of RED_FLAG_RULES.rules) keys.add(rule.basisKey);
  return [...keys];
}

function expand(
  authored: Record<string, string>,
  common: Record<string, string>,
): Record<string, string> {
  const catalogue: Record<string, string> = { ...authored };
  for (const key of requiredTextKeys()) {
    if (catalogue[key] !== undefined) continue;
    const suffix = key.startsWith('opt.') ? key.slice(key.lastIndexOf('.') + 1) : undefined;
    if (suffix !== undefined && common[suffix] !== undefined) catalogue[key] = common[suffix];
  }
  return catalogue;
}

export const CLINICAL_TEXT: Record<string, Record<string, string>> = {
  en: expand(CLINICAL_TEXT_EN, COMMON_OPTION_TEXT_EN),
  hi: expand(CLINICAL_TEXT_HI, COMMON_OPTION_TEXT_HI),
};

export interface CatalogueGap {
  locale: string;
  missing: string[];
}

/** Which locales are complete enough to be offered at all. */
export function catalogueGaps(): CatalogueGap[] {
  const keys = requiredTextKeys();
  return Object.entries(CLINICAL_TEXT)
    .map(([locale, catalogue]) => ({
      locale,
      missing: keys.filter((key) => catalogue[key] === undefined || catalogue[key] === ''),
    }))
    .filter((gap) => gap.missing.length > 0);
}
