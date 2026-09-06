import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createTextResolver } from '@gi-compass/core';
import { PageHeading, Panel } from '@/components/primitives';
import { StartCase } from '@/components/start-case';
import { currentPublishedTemplate } from '@/server/services/content-service';
import { requireWorkspace } from '@/lib/guard';
import { clinical } from '@/server/db';

/**
 * Choosing where to start.
 *
 * The options are symptom areas, never conditions. Asking a patient which disease they think they
 * have both biases their answers and asks them to do the thing they came here because they
 * cannot.
 *
 * An open draft is offered first rather than being silently resumed: a patient who came here to
 * describe a new problem should not find themselves seven questions into an old one.
 */
export default async function IntakeStartPage() {
  const user = await requireWorkspace('patient');
  const t = await getTranslations('case');
  const tIntake = await getTranslations('intake');

  const cases = await clinical().listPatientCases({
    actor: { id: user.id, role: user.role },
    subjectId: user.id,
    purpose: 'account_processing',
  });
  const draft = cases.find((entry) => entry.status === 'in_progress');

  const { document, index } = await currentPublishedTemplate();
  const resolve = createTextResolver(document, user.locale);

  const areas = [...document.template.entryPoints]
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      id: entry.id,
      label: resolve(entry.labelKey),
      cluster: index.groupById.get(entry.entryGroupId)?.cluster ?? 'history',
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading lead={t('chooseAreaIntro')}>{t('chooseAreaHeading')}</PageHeading>

      {draft !== undefined && (
        <div className="mb-6 rounded-xl border border-accent-line bg-accent-faint p-5">
          <h2 className="text-lg">{t('resumeHeading')}</h2>
          <p className="mt-1 text-ink-muted">{t('resumeBody')}</p>
          <Link href={`/patient/intake/${draft.id}`} className="gi-button-primary mt-4">
            {t('resume')}
          </Link>
          <p className="gi-hint">{tIntake('oneDraftAtATime')}</p>
        </div>
      )}

      <Panel title={tIntake('areasHeading')}>
        <StartCase areas={areas} />
      </Panel>
    </div>
  );
}
