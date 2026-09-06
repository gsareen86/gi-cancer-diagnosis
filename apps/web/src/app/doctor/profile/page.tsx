import { getTranslations } from 'next-intl/server';
import { Panel, PageHeading, DataPoint, Badge } from '@/components/primitives';
import { Avatar } from '@/components/ui/feedback';
import { requireWorkspace } from '@/lib/guard';

/**
 * The clinician's own account.
 *
 * Read-only for now. A doctor's name and registration are set by the clinical admin who created
 * the account, and letting a reviewer edit the name that appears on a released summary would put
 * attribution outside the audit trail.
 */
export default async function DoctorProfilePage() {
  const user = await requireWorkspace('doctor');
  const t = await getTranslations('profile');
  const tShell = await getTranslations('shell');

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading lead={t('doctorIntro')}>{t('heading')}</PageHeading>

      <Panel>
        <div className="flex items-center gap-4">
          <Avatar name={user.fullName} tone="ok" size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.fullName ?? user.email}</p>
            <span className="mt-1 inline-block">
              <Badge tone="ok">{tShell('roleDoctor')}</Badge>
            </span>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <DataPoint label={t('email')} value={user.email} absent={t('notSet')} />
          <DataPoint label={t('fullName')} value={user.fullName} absent={t('notSet')} />
          <DataPoint label={t('locale')} value={user.locale} absent={t('notSet')} />
          <DataPoint label={t('accountStatus')} value={user.status} absent={t('notSet')} />
        </dl>

        <p className="mt-6 border-t border-line pt-4 text-sm text-ink-muted">
          {t('doctorManagedByAdmin')}
        </p>
      </Panel>
    </div>
  );
}
