import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/language-switcher';
import { servableLocales } from '@/lib/servable-locales';
import { Breadcrumbs } from './breadcrumbs';
import { AccountMenu } from './account-menu';
import { AccessDeniedToast } from './access-denied-toast';
import { NotificationBell } from './notification-bell';
import { WorkspaceNav, type NavItem } from './workspace-nav';
import { StethoscopeIcon, PulseIcon, ShieldIcon } from '@/components/ui/icons';

/**
 * The application shell.
 *
 * One component serves all three workspaces, differing only in what it is handed: the navigation
 * items, the role badge, the density, and where a notification's case link points. Three shells
 * would drift, and the thing they would drift on is the account menu — which is where sign-out
 * lives.
 *
 * Density is set here rather than per-component: `data-density="compact"` on the wrapper tightens
 * type, padding and control heights for the clinician workspaces, and the patient tree simply
 * never carries the attribute, so its 44px targets and 17px reading size are untouched whatever
 * the viewport.
 */

export type ShellRole = 'patient' | 'doctor' | 'admin';

export interface Crumb {
  label: string;
  href?: string;
}

export async function AppShell({
  role,
  user,
  nav,
  crumbs,
  children,
}: {
  role: ShellRole;
  user: { email: string; fullName: string | null };
  nav: NavItem[];
  /** The trail below the workspace root. The root itself is prepended here. */
  crumbs?: Crumb[] | undefined;
  children: ReactNode;
}) {
  const t = await getTranslations('shell');
  const tApp = await getTranslations('app');

  const roleKey = role === 'doctor' ? 'roleDoctor' : role === 'admin' ? 'roleAdmin' : 'rolePatient';
  const roleTone = role === 'patient' ? 'accent' : 'ok';
  const compact = role !== 'patient';

  const root =
    role === 'doctor'
      ? { href: '/doctor/dashboard', label: t('workspaceDoctor') }
      : role === 'admin'
        ? { href: '/admin', label: t('workspaceAdmin') }
        : { href: '/patient/dashboard', label: t('workspacePatient') };

  const RoleIcon = role === 'doctor' ? StethoscopeIcon : role === 'admin' ? ShieldIcon : PulseIcon;

  return (
    <div
      data-workspace={role}
      data-density={compact ? 'compact' : undefined}
      className="flex min-h-screen flex-col bg-surface-sunken"
    >
      <AccessDeniedToast message={t('accessDenied')} />

      <header className="gi-no-print sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-shell items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link
            href={root.href}
            aria-label={tApp('name')}
            className="flex shrink-0 items-center gap-2.5 rounded-lg py-1 pr-2 font-semibold tracking-tight text-ink"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-deep text-white"
            >
              <RoleIcon className="h-4 w-4" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm leading-tight">{tApp('name')}</span>
              <span className="block text-2xs font-normal leading-tight text-ink-faint">
                {root.label}
              </span>
            </span>
          </Link>

          <Breadcrumbs root={root} crumbs={crumbs} nav={nav.map(({ href, label }) => ({ href, label }))} label={t('breadcrumbLabel')} />

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <LanguageSwitcher available={await servableLocales()} />
            <NotificationBell
              caseHrefPrefix={role === 'doctor' ? '/doctor/case' : '/patient/case'}
            />
            <AccountMenu
              name={user.fullName}
              email={user.email}
              roleTone={roleTone}
              profileHref={role === 'patient' ? '/patient/profile' : '/doctor/profile'}
              notificationsHref={
                role === 'doctor' ? '/doctor/notifications' : '/patient/notifications'
              }
              privacyHref={role === 'patient' ? '/patient/privacy' : undefined}
              labels={{
                openMenu: t('openAccountMenu'),
                roleLabel: t(roleKey as never),
                profile: t('profile'),
                notifications: t('notifications'),
                privacy: t('privacy'),
                signOut: t('signOut'),
                signingOut: t('signingOut'),
                signedOut: t('signedOut'),
                signOutFailed: t('signOutFailed'),
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-shell flex-1 gap-6 px-4 py-4 sm:px-6 lg:py-6">
        <aside className="gi-no-print hidden w-52 shrink-0 lg:block">
          <div className="sticky top-[4.25rem]">
            <WorkspaceNav items={nav} label={t('navLabel')} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-3 lg:hidden">
            <WorkspaceNav items={nav} label={t('navLabel')} />
          </div>
          <main id="main">{children}</main>
        </div>
      </div>

      <footer className="gi-no-print mt-auto border-t border-line bg-surface">
        <div className="mx-auto max-w-shell px-4 py-5 text-sm text-ink-muted sm:px-6">
          {role === 'patient' ? <StandingNotice /> : <ClinicianNotice />}
        </div>
      </footer>
    </div>
  );
}

/**
 * Shown on every page, not just the questionnaire.
 *
 * A patient who lands on their case status at 2am and reads "with the doctor" needs to know, in
 * that same moment, that waiting is not the right move if things are getting worse.
 */
async function StandingNotice() {
  const t = await getTranslations('standingNotice');
  return (
    <div className="gi-prose space-y-1">
      <p>{t('notADiagnosis')}</p>
      <p className="font-medium text-ink">{t('seekCare')}</p>
    </div>
  );
}

/**
 * The clinician's version.
 *
 * The patient notice tells the reader to seek care in person if their symptoms worsen, which is
 * addressed to a person with symptoms. Printing it under a triage queue told a gastroenterologist
 * to go to hospital — the standing constraint that actually applies to them is a different one.
 */
async function ClinicianNotice() {
  const t = await getTranslations('shell');
  return (
    <div className="gi-prose space-y-1">
      <p>{t('clinicianNotice')}</p>
      <p className="font-medium text-ink">{t('clinicianNoticeAuthority')}</p>
    </div>
  );
}
