import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonRows } from './feedback';

export async function WorkspaceLoading() {
  const t = await getTranslations('app');
  return <div role="status" aria-label={t('loading')} className="space-y-6">
    <Skeleton className="h-8 w-64" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((id) => <Skeleton key={id} className="h-28 rounded-xl" />)}</div>
    <SkeletonRows rows={6} columns={4} label={t('loading')} />
  </div>;
}
