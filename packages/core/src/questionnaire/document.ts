import { z } from 'zod';
import { templateVersionSchema, type TemplateVersion } from './template';
import { redFlagRuleSetSchema } from '../safety/red-flags';

/**
 * What a published template version actually stores.
 *
 * Clinical text — question prompts, answer options, help text, image captions, red-flag
 * escalation copy — lives *with* the versioned clinical content rather than in the application's
 * message catalogues (design D12). That is what makes "publication is refused for a locale whose
 * clinical text is not clinician-approved" enforceable: the approval and the text are the same
 * artefact, versioned together. Interface chrome stays in the app's own i18n catalogues.
 */

export const localeTextSchema = z.record(z.string().min(1), z.string());

export const templateDocumentSchema = z.object({
  template: templateVersionSchema,
  /** locale → (catalogue key → clinical text). */
  clinicalText: z.record(z.string().min(2), localeTextSchema),
  /** Locales a clinician has signed off for this exact version. */
  approvedLocales: z.array(z.string().min(2)).min(1),
});

export type TemplateDocument = z.infer<typeof templateDocumentSchema>;

export const redFlagDocumentSchema = z.object({
  ruleSet: redFlagRuleSetSchema,
  clinicalText: z.record(z.string().min(2), localeTextSchema),
  approvedLocales: z.array(z.string().min(2)).min(1),
});

export type RedFlagDocument = z.infer<typeof redFlagDocumentSchema>;

/**
 * Builds a resolver over a document for one locale, falling back to English so a missing
 * translation shows real text rather than a raw key. The gap is reported, not swallowed.
 */
export function createTextResolver(
  document: Pick<TemplateDocument, 'clinicalText'>,
  locale: string,
  onMissing?: (key: string, locale: string) => void,
): (key: string) => string {
  const primary = document.clinicalText[locale] ?? {};
  const fallback = document.clinicalText.en ?? {};
  return (key: string): string => {
    const direct = primary[key];
    if (direct !== undefined) return direct;
    onMissing?.(key, locale);
    return fallback[key] ?? key;
  };
}

/** Locales this document can actually serve: approved *and* carrying clinical text. */
export function servableLocales(document: TemplateDocument): string[] {
  return document.approvedLocales.filter((locale) => {
    const catalogue = document.clinicalText[locale];
    return catalogue !== undefined && Object.keys(catalogue).length > 0;
  });
}

export function templateOf(document: TemplateDocument): TemplateVersion {
  return document.template;
}
