'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { Avatar } from '@/components/ui/feedback';
import { Badge } from '@/components/primitives';
import { useToast } from '@/components/ui/toast';
import { ChevronDownIcon, InboxIcon, LogOutIcon, ShieldIcon, UserIcon } from '@/components/ui/icons';

/**
 * The account control.
 *
 * Its reason for existing is the last item on it. Until this change there was no way to sign out
 * of GI Compass from the interface at all — the endpoint existed, nothing called it. On a shared
 * or clinic machine that is not an inconvenience, it is the session staying open behind whoever
 * sits down next.
 *
 * Signing out revokes the refresh-token family server-side, not just the cookies, so a stolen
 * refresh token does not outlive the sign-out.
 */

export interface AccountMenuLabels {
  openMenu: string;
  roleLabel: string;
  profile: string;
  notifications: string;
  privacy: string;
  signOut: string;
  signingOut: string;
  signedOut: string;
  signOutFailed: string;
}

export function AccountMenu({
  name,
  email,
  roleTone,
  labels,
  profileHref,
  notificationsHref,
  privacyHref,
}: {
  name: string | null;
  email: string;
  roleTone: 'accent' | 'ok';
  labels: AccountMenuLabels;
  profileHref: string;
  notificationsHref: string;
  /** Patients get a privacy entry; clinicians have no consent of their own to manage. */
  privacyHref?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    container.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      const items = [...(container.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
          (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
        items[index]?.focus();
      }
    }
    function onFocus(event: FocusEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false); }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open]);

  async function signOut() {
    setPending(true);
    const result = await api.post('/api/auth/logout');
    setPending(false);

    if (!result.ok) {
      toast({ message: labels.signOutFailed, tone: 'emergency' });
      return;
    }

    toast({ message: labels.signedOut, tone: 'ok' });
    setOpen(false);
    // `replace` plus `refresh`: the server components hold the session, so a push would leave a
    // signed-in render sitting in history for the back button to find.
    router.replace('/login');
    router.refresh();
  }

  return (
    <div ref={container} className="relative gi-no-print">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={labels.openMenu}
        className="flex min-h-11 items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-surface-inset"
      >
        <Avatar name={name} tone={roleTone} size="md" />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-sm font-medium text-ink">{name ?? email}</span>
          <span className="block truncate text-2xs text-ink-faint">{labels.roleLabel}</span>
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 animate-gi-rise overflow-hidden rounded-xl border border-line bg-surface shadow-overlay"
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Avatar name={name} tone={roleTone} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{name ?? email}</p>
              <p className="truncate text-xs text-ink-muted">{email}</p>
              <span className="mt-1.5 inline-block">
                <Badge tone={roleTone}>{labels.roleLabel}</Badge>
              </span>
            </div>
          </div>

          <div className="p-1.5">
            <MenuLink href={profileHref} onNavigate={() => setOpen(false)}>
              <UserIcon className="h-4 w-4" />
              {labels.profile}
            </MenuLink>
            <MenuLink href={notificationsHref} onNavigate={() => setOpen(false)}>
              <InboxIcon className="h-4 w-4" />
              {labels.notifications}
            </MenuLink>
            {privacyHref !== undefined && (
              <MenuLink href={privacyHref} onNavigate={() => setOpen(false)}>
                <ShieldIcon className="h-4 w-4" />
                {labels.privacy}
              </MenuLink>
            )}
          </div>

          <div className="border-t border-line p-1.5">
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-emergency transition-colors hover:bg-emergency-faint disabled:opacity-60"
            >
              <LogOutIcon className="h-4 w-4" />
              {pending ? labels.signingOut : labels.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink"
    >
      {children}
    </Link>
  );
}
