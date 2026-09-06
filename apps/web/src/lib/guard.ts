import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { consentState } from '@/server/services/consent-service';
import { currentUser, profileComplete, type CurrentUser } from './session';
import { homePathFor, withNext } from './navigation';
export { homePathFor } from './navigation';

/**
 * The workspace boundary.
 *
 * One place, resolved once per request by the workspace layout, so no page beneath it is the
 * only thing remembering to check. Before this, `/doctor/queue` and `/doctor/cases/[caseId]`
 * each carried their own three-line redirect ladder — which works right up until the fourth
 * doctor page is added without one.
 *
 * This is a usability affordance, never an access control. Every API route still declares the
 * roles it serves, and every clinical read still runs the repository's consent and audit hooks.
 * What this removes is the dead end: a patient who follows a stale doctor link gets their own
 * dashboard and an explanation, not a blank page or a raw 403.
 */

export type Workspace = 'patient' | 'doctor' | 'admin';

/** Where each role actually works. Used both as a guard target and as the post-login landing. */
function workspaceOf(role: CurrentUser['role']): Workspace {
  if (role === 'doctor') return 'doctor';
  if (role === 'clinical_admin' || role === 'platform_admin') return 'admin';
  return 'patient';
}

export interface GuardOptions {
  /**
   * Overrides the requested path. Normally left unset: the path comes from the `x-pathname`
   * header the middleware sets, because a server component cannot read its own URL.
   */
  pathname?: string;
  /**
   * Set on the profile and consent pages themselves. Without it those two pages would redirect
   * to themselves forever, since the very state they exist to fix is what triggers the redirect.
   */
  skipOnboardingChecks?: boolean;
}

/**
 * Resolves the session for a workspace, or redirects.
 *
 * The order matters. Authentication before role, because "who are you" precedes "may you be
 * here". The second factor before either onboarding check, because a session pending its second
 * factor must reach nothing but enrolment. And profile before consent, because the consent text
 * is age-dependent.
 */
export async function requireWorkspace(
  workspace: Workspace,
  options: GuardOptions = {},
): Promise<CurrentUser> {
  const user = await currentUser();
  const next = options.pathname ?? (await headers()).get('x-pathname');

  if (user === null) {
    // So the visitor lands on what they were reaching for rather than on a dashboard, having
    // forgotten what they came for. Only ever a same-origin path — see `middleware.ts`.
    redirect(withNext('/login', next));
  }

  if (user.mfaPending) redirect(withNext('/mfa', next));

  if (workspaceOf(user.role) !== workspace) {
    // `denied` is read by the shell, which raises a toast. A redirect that silently lands
    // somewhere else reads as a bug; one that says why reads as a rule.
    redirect(`${homePathFor(user.role)}?denied=1`);
  }

  if (workspace === 'patient' && options.skipOnboardingChecks !== true) {
    if (!profileComplete(user)) redirect('/patient/profile');

    const consents = await consentState(user.id);
    const storage = consents.purposes.find(
      (purpose) => purpose.purpose === 'account_processing',
    )?.granted;
    if (storage !== true) redirect('/patient/consent');
  }

  return user;
}
