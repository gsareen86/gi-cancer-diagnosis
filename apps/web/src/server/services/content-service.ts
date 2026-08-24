import { and, desc, eq } from 'drizzle-orm';
import {
  indexTemplate,
  redFlagDocumentSchema,
  templateDocumentSchema,
  type RedFlagRuleSet,
  type TemplateDocument,
  type TemplateIndex,
} from '@gi-compass/core';
import { tables } from '@gi-compass/db';
import { database } from '../db';

/**
 * Reads published clinical content.
 *
 * Template versions are immutable once published, so the parsed and indexed form is cached per
 * version id. A case pins its version, which means an in-flight interview keeps its content even
 * after a newer version is published.
 */

interface CachedTemplate {
  versionId: string;
  document: TemplateDocument;
  index: TemplateIndex;
}

const templateCache = new Map<string, CachedTemplate>();

export async function loadTemplateVersion(versionId: string): Promise<CachedTemplate> {
  const cached = templateCache.get(versionId);
  if (cached) return cached;

  const [row] = await database()
    .select()
    .from(tables.templateVersions)
    .where(eq(tables.templateVersions.id, versionId))
    .limit(1);
  if (!row) throw new Error(`Template version ${versionId} does not exist`);

  // Parsed rather than trusted: the column is JSON, and content that no longer matches the
  // schema must fail loudly here rather than half-render an interview.
  const document = templateDocumentSchema.parse(row.content);
  const entry: CachedTemplate = { versionId, document, index: indexTemplate(document.template) };
  templateCache.set(versionId, entry);
  return entry;
}

export async function currentPublishedTemplate(templateKey = 'gi-intake'): Promise<CachedTemplate> {
  const [row] = await database()
    .select({ id: tables.templateVersions.id })
    .from(tables.templateVersions)
    .innerJoin(
      tables.questionnaireTemplates,
      eq(tables.questionnaireTemplates.id, tables.templateVersions.templateId),
    )
    .where(
      and(
        eq(tables.questionnaireTemplates.key, templateKey),
        eq(tables.templateVersions.status, 'published'),
      ),
    )
    .orderBy(desc(tables.templateVersions.version))
    .limit(1);
  if (!row) throw new Error(`No published version of template "${templateKey}"`);
  return loadTemplateVersion(row.id);
}

export interface PublishedRedFlags {
  ruleSetId: string;
  ruleSet: RedFlagRuleSet;
  clinicalText: Record<string, Record<string, string>>;
}

let redFlagCache: PublishedRedFlags | null = null;

export async function currentRedFlagRules(): Promise<PublishedRedFlags> {
  if (redFlagCache) return redFlagCache;

  const [row] = await database()
    .select()
    .from(tables.redFlagRuleSets)
    .where(eq(tables.redFlagRuleSets.status, 'published'))
    .orderBy(desc(tables.redFlagRuleSets.version))
    .limit(1);
  if (!row) throw new Error('No published red-flag rule set');

  const document = redFlagDocumentSchema.parse(row.content);
  redFlagCache = {
    ruleSetId: row.id,
    ruleSet: document.ruleSet,
    clinicalText: document.clinicalText,
  };
  return redFlagCache;
}

/** Called after a publish, so the next request picks up the new version. */
export function invalidateContentCache(): void {
  templateCache.clear();
  redFlagCache = null;
}

export async function listReferenceImages(keys: readonly string[]) {
  if (keys.length === 0) return [];
  const rows = await database().select().from(tables.referenceImages);
  return rows.filter((row) => keys.includes(row.key));
}

export async function activeTaxonomy() {
  return database()
    .select()
    .from(tables.diseaseTaxonomyEntries)
    .where(eq(tables.diseaseTaxonomyEntries.active, true));
}
