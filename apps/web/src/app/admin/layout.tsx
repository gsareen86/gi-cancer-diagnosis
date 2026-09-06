import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/shell/app-shell';
import type { NavItem } from '@/components/shell/workspace-nav';
import { requireWorkspace } from '@/lib/guard';

/** The clinical-content console. Same shell, same guard, a different set of sections. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireWorkspace('admin');
  const t = await getTranslations('shell');

  const nav: NavItem[] = [
    { href: '/admin', label: t('navContent'), icon: 'content' },
    { href: '/admin/preview', label: t('navPreview'), icon: 'preview' },
  ];

  return (
    <AppShell role="admin" user={{ email: user.email, fullName: user.fullName }} nav={nav}>
      {children}
    </AppShell>
  );
}
