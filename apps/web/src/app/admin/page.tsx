import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Notice, PageHeading } from '@/components/primitives';
import { activeTaxonomy, currentPublishedTemplate, currentRedFlagRules } from '@/server/services/content-service';
import { database } from '@/server/db';
import { tables } from '@gi-compass/db';
import { currentUser } from '@/lib/session';

/**
 * The clinical admin console.
 *
 * A clinical admin has full authority over what the platform asks and how it escalates, and no
 * access at all to what any patient answered. Nothing on this page reads a case.
 */
export default async function AdminPage() {
  const t = await getTranslations('admin');
  const user = await currentUser();

  if (user === null) redirect('/login');
  if (user.role !== 'clinical_admin' && user.role !== 'platform_admin') redirect('/');

  const { document } = await currentPublishedTemplate();
  const rules = await currentRedFlagRules();
  const taxonomy = await activeTaxonomy();
  const images = await database().select().from(tables.referenceImages);

  const unattributed = images.filter(
    (image) => image.source.startsWith('TODO') || image.licence.startsWith('TODO'),
  );

  return (
    <div>
      <PageHeading>{t('heading')}</PageHeading>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <h2 className="text-lg">{t('templatesHeading')}</h2>
          <p className="mt-1 text-ink-muted">
            {t('publishedVersion', { version: document.template.version })}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-ink-muted">
            <li>{t('questionCount', { count: document.template.questions.length })}</li>
            <li>{t('ruleCount', { count: document.template.rules.length })}</li>
            <li>{t('redFlagCount', { count: rules.ruleSet.rules.length })}</li>
          </ul>
          <Link href="/admin/preview" className="gi-button-secondary mt-4">
            {t('previewHeading')}
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg">{t('taxonomyHeading')}</h2>
          <ul className="mt-3 space-y-2">
            {taxonomy.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2">
                <span>{entry.label}</span>
                {entry.urgentReferralOnly && (
                  <Badge tone="urgent">{t('urgentReferralOnly')}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="text-lg">{t('imagesHeading')}</h2>
        {unattributed.length > 0 && (
          <div className="mt-3">
            {/* Stated plainly: an asset without a recorded source and licence cannot be published,
                and a patient will see a caption where a picture should be. */}
            <Notice tone="urgent" role="note">
              {t('imageUnattributed')} — {unattributed.length}/{images.length}
            </Notice>
          </div>
        )}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {images.map((image) => (
            <li key={`${image.key}-${image.version}`} className="flex items-center gap-2 text-sm">
              <Badge tone={image.status === 'published' ? 'ok' : 'neutral'}>{image.status}</Badge>
              <span className="truncate">{image.key}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
