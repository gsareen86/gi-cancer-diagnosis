import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import {
  redFlagRuleSetSchema,
  templateDocumentSchema,
  templateVersionSchema,
  validateEscalationCopy,
  validateForPublication,
  type TemplateDocument,
  type TemplateVersion,
} from '@gi-compass/core';
import { createDatabase, createPool } from '../client';
import * as schema from '../schema';
import type { Database } from '../client';
import { ENTRY_POINTS, GROUPS, QUESTIONS, RULES } from './questions';
import { RED_FLAG_RULES } from './red-flags';
import { CLINICAL_TEXT, catalogueGaps, requiredTextKeys } from './text';
import { TAXONOMY } from './taxonomy';
import { isPublishable, REFERENCE_IMAGES } from './reference-images';

/**
 * Seeds the clinical content.
 *
 * The seed publishes nothing it cannot validate. The template goes through the same publication
 * checks the admin console uses — cycle detection, dangling references, predicate/type agreement,
 * reachability, lay explanations — and the red-flag copy through the same condition-naming check.
 * A seed that quietly installed invalid content would defeat the point of having those checks.
 *
 * Idempotent: running it twice leaves the same published version rather than a second copy.
 */

export const TEMPLATE_KEY = 'gi-intake';
export const SEED_POLICY_VERSION = 'privacy-policy-2026-01';

export function buildTemplateVersion(version: number): TemplateVersion {
  return templateVersionSchema.parse({
    templateId: TEMPLATE_KEY,
    version,
    status: 'published',
    entryPoints: ENTRY_POINTS,
    groups: GROUPS,
    questions: QUESTIONS,
    rules: RULES,
    // English only. Hindi clinical text exists but has not been clinician-approved, and the
    // publication check refuses a locale whose clinical text nobody has signed off.
    // TODO(confirm): add 'hi' once a Hindi-speaking clinician has reviewed the translation.
    approvedLocales: ['en'],
  });
}

export function buildTemplateDocument(version: number): TemplateDocument {
  return templateDocumentSchema.parse({
    template: buildTemplateVersion(version),
    clinicalText: CLINICAL_TEXT,
    approvedLocales: ['en'],
  });
}

export interface SeedValidation {
  ok: boolean;
  problems: string[];
}

/** Runs every check publication would run, before anything is written. */
export function validateSeedContent(): SeedValidation {
  const problems: string[] = [];
  const document = buildTemplateDocument(1);

  const publication = validateForPublication(document.template, {
    requiredLocales: document.approvedLocales,
  });
  for (const problem of publication.problems) {
    problems.push(`${problem.code}: ${problem.message}`);
  }

  const ruleSet = redFlagRuleSetSchema.parse(RED_FLAG_RULES);
  const questionIds = new Set(document.template.questions.map((question) => question.id));
  for (const rule of ruleSet.rules) {
    // Red-flag rules read the same answers the questionnaire collects; a rule reading a question
    // that no longer exists would silently never fire, which is the worst failure mode here.
    const referenced = referencedIds(rule.when);
    for (const questionId of referenced) {
      if (!questionIds.has(questionId)) {
        problems.push(`red_flag_unknown_question: rule "${rule.id}" reads unknown "${questionId}"`);
      }
    }
    for (const locale of document.approvedLocales) {
      const copy = CLINICAL_TEXT[locale]?.[rule.basisKey];
      if (copy === undefined) {
        problems.push(`red_flag_missing_copy: "${rule.basisKey}" has no ${locale} text`);
        continue;
      }
      for (const naming of validateEscalationCopy(copy)) {
        problems.push(`red_flag_names_a_condition: "${rule.id}" — ${naming.message}`);
      }
    }
  }

  for (const gap of catalogueGaps()) {
    if (!document.approvedLocales.includes(gap.locale)) continue;
    problems.push(
      `missing_clinical_text: ${gap.locale} is missing ${gap.missing.length} keys ` +
        `(first: ${gap.missing.slice(0, 3).join(', ')})`,
    );
  }

  return { ok: problems.length === 0, problems };
}

function referencedIds(condition: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.of)) {
      record.of.forEach(walk);
      return;
    }
    if (record.of !== undefined) {
      walk(record.of);
      return;
    }
    if (typeof record.questionId === 'string') found.push(record.questionId);
  };
  walk(condition);
  return found;
}

export async function seed(db: Database, options: { actorId?: string } = {}): Promise<void> {
  const validation = validateSeedContent();
  if (!validation.ok) {
    throw new Error(`Seed content failed validation:\n  - ${validation.problems.join('\n  - ')}`);
  }

  const actorId = options.actorId ?? (await ensureBootstrapAdmin(db));

  await db
    .insert(schema.consentPolicyVersions)
    .values({
      version: SEED_POLICY_VERSION,
      bodyByLocale: {
        en: 'TODO(confirm): Decision G — the privacy notice text, once the Data Fiduciary is settled.',
        hi: 'TODO(confirm): Decision G — गोपनीयता सूचना का पाठ।',
      },
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      dataFiduciaryName: 'TODO(confirm): Decision G — data fiduciary entity',
      grievanceContact: 'TODO(confirm): Decision G — grievance officer contact',
    })
    .onConflictDoNothing({ target: schema.consentPolicyVersions.version });

  for (const entry of TAXONOMY) {
    await db
      .insert(schema.diseaseTaxonomyEntries)
      .values({
        id: entry.id,
        label: entry.label,
        clusters: [...entry.clusters],
        urgentReferralOnly: entry.urgentReferralOnly,
        active: entry.active,
      })
      .onConflictDoUpdate({
        target: schema.diseaseTaxonomyEntries.id,
        set: { label: entry.label, clusters: [...entry.clusters], active: entry.active },
      });
  }

  const [template] = await db
    .insert(schema.questionnaireTemplates)
    .values({ key: TEMPLATE_KEY, name: 'GI symptom intake' })
    .onConflictDoUpdate({
      target: schema.questionnaireTemplates.key,
      set: { name: 'GI symptom intake' },
    })
    .returning({ id: schema.questionnaireTemplates.id });
  if (!template) throw new Error('template upsert returned nothing');

  const existing = await db
    .select({ version: schema.templateVersions.version })
    .from(schema.templateVersions)
    .where(eq(schema.templateVersions.templateId, template.id));

  if (existing.length === 0) {
    const document = buildTemplateDocument(1);
    await db.insert(schema.templateVersions).values({
      templateId: template.id,
      version: 1,
      status: 'published',
      content: document,
      approvedLocales: document.approvedLocales,
      createdBy: actorId,
      publishedBy: actorId,
      publishedAt: new Date(),
    });
  }

  const ruleSetExists = await db
    .select({ id: schema.redFlagRuleSets.id })
    .from(schema.redFlagRuleSets)
    .where(eq(schema.redFlagRuleSets.version, RED_FLAG_RULES.version));

  if (ruleSetExists.length === 0) {
    await db.insert(schema.redFlagRuleSets).values({
      version: RED_FLAG_RULES.version,
      status: 'published',
      content: { ruleSet: RED_FLAG_RULES, clinicalText: CLINICAL_TEXT, approvedLocales: ['en'] },
      createdBy: actorId,
      publishedAt: new Date(),
    });
  }

  for (const asset of REFERENCE_IMAGES) {
    await db
      .insert(schema.referenceImages)
      .values({
        key: asset.key,
        version: 1,
        // Draft, not published: attribution is still a placeholder, and an asset without a real
        // source and licence must never reach a patient.
        status: isPublishable(asset) ? 'published' : 'draft',
        captionKey: asset.captionKey,
        altTextKey: asset.altTextKey,
        source: asset.source,
        licence: asset.licence,
        storageKey: asset.storageKey,
        createdBy: actorId,
      })
      .onConflictDoNothing({ target: [schema.referenceImages.key, schema.referenceImages.version] });
  }

  // Retention deliberately ships with no periods set. The job alerts rather than deleting until
  // counsel sets them — the safe direction when nobody has decided yet.
  // TODO(confirm): Decision F — retention periods per category.
  for (const category of [
    'abandoned_draft_case',
    'submitted_case',
    'released_case',
    'uploaded_document',
    'ai_assessment',
    'audit_log',
    'notification_delivery',
  ]) {
    await db
      .insert(schema.retentionPolicies)
      .values({ category, retentionDays: null, action: 'alert_only' })
      .onConflictDoNothing({ target: schema.retentionPolicies.category });
  }

  await db
    .insert(schema.knowledgeBaseSnapshots)
    .values({ version: 'kb-seed-1', reason: 'Initial seed' })
    .onConflictDoNothing({ target: schema.knowledgeBaseSnapshots.version });
}

/**
 * The first platform admin. Created with an unusable password hash and left `unverified`, so the
 * account exists to own the seeded content but cannot be signed into until someone runs the
 * documented bootstrap step out of band.
 */
async function ensureBootstrapAdmin(db: Database): Promise<string> {
  const email = 'bootstrap-admin@gi-compass.invalid';
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(schema.users)
    .values({
      email,
      // Not a hash of anything: no password can produce it, so this account cannot be signed into.
      passwordHash: `unusable:${randomUUID()}`,
      role: 'platform_admin',
      status: 'unverified',
    })
    .returning({ id: schema.users.id });
  if (!created) throw new Error('bootstrap admin creation failed');
  return created.id;
}

const isDirectInvocation = process.argv[1]?.includes('seed') === true;
if (isDirectInvocation) {
  const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (connectionString === undefined) {
    console.error('Neither MIGRATION_DATABASE_URL nor DATABASE_URL is set');
    process.exit(1);
  }
  const pool = createPool({ connectionString, maxConnections: 1 });
  const db = createDatabase(pool);
  seed(db)
    .then(async () => {
      const rows = (await db.execute(sql`SELECT count(*)::int AS count FROM template_versions`))
        .rows as Array<{ count: number }>;
      const count = rows[0]?.count ?? 0;
      console.log(
        `seed complete — ${count} template version(s), ${requiredTextKeys().length} text keys`,
      );
      await pool.end();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
