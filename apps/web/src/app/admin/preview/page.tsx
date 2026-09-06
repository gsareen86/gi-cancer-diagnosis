import { getTranslations } from 'next-intl/server';
import { createTextResolver } from '@gi-compass/core';
import { PageHeading } from '@/components/primitives';
import { TemplatePreview } from '@/components/admin/template-preview';
import { currentPublishedTemplate, currentRedFlagRules } from '@/server/services/content-service';
import { requireWorkspace } from '@/lib/guard';

/**
 * Preview mode.
 *
 * Walks the real questionnaire — the same engine, the same branching rules, the same red-flag
 * evaluation — entirely in the browser. No case is created, no answer is stored, and nothing
 * touches the clinical tables. That is what makes it safe to hand to a clinician who wants to try
 * a path before publishing it.
 */
export default async function PreviewPage() {
  const t = await getTranslations('admin');
  // Authentication, second factor and role are settled by `app/admin/layout.tsx`.
  await requireWorkspace('admin');

  const { document } = await currentPublishedTemplate();
  const rules = await currentRedFlagRules();
  const resolve = createTextResolver(document, 'en');

  return (
    <div className="mx-auto max-w-reading">
      <PageHeading lead={t('previewIntro')}>{t('previewHeading')}</PageHeading>
      <TemplatePreview
        template={document.template}
        clinicalText={document.clinicalText}
        redFlagRules={rules.ruleSet}
        redFlagText={rules.clinicalText}
        entryPointLabels={Object.fromEntries(
          document.template.entryPoints.map((entry) => [entry.id, resolve(entry.labelKey)]),
        )}
      />
    </div>
  );
}
