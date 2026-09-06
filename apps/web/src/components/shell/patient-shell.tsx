import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { AppShell, type Crumb } from './app-shell';
import type { NavItem } from './workspace-nav';
import { requireWorkspace } from '@/lib/guard';

/**
 * The patient workspace shell, guard included.
 *
 * The guard runs here, once, before any page below renders — so a page added tomorrow is
 * protected by existing rather than by someone remembering the redirect ladder. It is not an
 * access control: every API route still declares its roles and every clinical read still runs
 * the repository's consent and audit hooks. What this removes is the dead end.
 */
export async function PatientShell({
  children,
  crumbs,
  skipOnboardingChecks = false,
}: {
  children: ReactNode;
  crumbs?: Crumb[] | undefined;
  /** Set by the profile, consent and privacy pages, which exist to fix what the guard checks. */
  skipOnboardingChecks?: boolean;
}) {
  const user = await requireWorkspace('patient', { skipOnboardingChecks });
  const t = await getTranslations('shell');

  const nav: NavItem[] = [
    { href: '/patient/dashboard', label: t('navDashboard'), icon: 'dashboard' },
    { href: '/patient/intake', label: t('navIntake'), icon: 'intake' },
    { href: '/patient/records', label: t('navRecords'), icon: 'records' },
    { href: '/patient/profile', label: t('navProfile'), icon: 'profile' },
    { href: '/patient/privacy', label: t('navPrivacy'), icon: 'privacy' },
  ];

  return (
    <AppShell
      role="patient"
      user={{ email: user.email, fullName: user.fullName }}
      nav={nav}
      crumbs={crumbs}
    >
      {children}
    </AppShell>
  );
}
