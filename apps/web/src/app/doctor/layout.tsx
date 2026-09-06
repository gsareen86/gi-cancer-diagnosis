import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/shell/app-shell';
import type { NavItem } from '@/components/shell/workspace-nav';
import { requireWorkspace } from '@/lib/guard';

/**
 * The clinical workspace.
 *
 * One guard for every doctor route, replacing the three-line redirect ladder that `/doctor/queue`
 * and `/doctor/cases/[caseId]` each carried their own copy of — an arrangement that works right
 * up until the fourth doctor page is added without one.
 *
 * No onboarding checks: a doctor has no consent of their own to grant and no date of birth the
 * platform needs. The second-factor check is inside the guard and applies to every role.
 */
export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const user = await requireWorkspace('doctor');
  const t = await getTranslations('shell');

  const nav: NavItem[] = [
    { href: '/doctor/dashboard', label: t('navDashboard'), icon: 'dashboard' },
    { href: '/doctor/triage', label: t('navTriage'), icon: 'triage' },
    { href: '/doctor/analytics', label: t('navAnalytics'), icon: 'analytics' },
    { href: '/doctor/notifications', label: t('navNotifications'), icon: 'notifications' },
  ];

  return (
    <AppShell role="doctor" user={{ email: user.email, fullName: user.fullName }} nav={nav}>
      {children}
    </AppShell>
  );
}
