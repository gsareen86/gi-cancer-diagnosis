'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  ChartIcon,
  ClipboardIcon,
  FileIcon,
  InboxIcon,
  LayersIcon,
  PulseIcon,
  SettingsIcon,
  ShieldIcon,
  UploadIcon,
  UserIcon,
} from '@/components/ui/icons';

/**
 * The workspace navigation.
 *
 * A client component only because it needs `usePathname` to mark the current section. Icons are
 * looked up from a key rather than passed in, so the server component that renders this hands
 * over plain serializable data.
 *
 * On a wide screen it is a fixed left rail; below `lg` it becomes a horizontally scrollable strip
 * under the topbar. It is deliberately not a hamburger: a doctor triaging on a tablet should be
 * one tap from the queue, not two.
 */

export type NavIconKey =
  | 'dashboard'
  | 'triage'
  | 'analytics'
  | 'intake'
  | 'records'
  | 'profile'
  | 'privacy'
  | 'notifications'
  | 'content'
  | 'preview';

const ICONS: Record<NavIconKey, (props: { className?: string }) => ReactNode> = {
  dashboard: PulseIcon,
  triage: ClipboardIcon,
  analytics: ChartIcon,
  intake: UploadIcon,
  records: FileIcon,
  profile: UserIcon,
  privacy: ShieldIcon,
  notifications: InboxIcon,
  content: LayersIcon,
  preview: SettingsIcon,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  /** Rendered on the right of the row — an unread count, a queue depth. */
  badge?: string;
}

function isCurrent(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // `/doctor/case/abc` should light up `/doctor/triage`'s sibling only when it is that section's
  // own subtree, so an exact-or-prefix test with the boundary character avoids `/patient/case`
  // matching `/patient/cases-archive`.
  return pathname.startsWith(`${href}/`);
}

export function WorkspaceNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="gi-no-print">
      {/* Wide: a vertical rail. */}
      <ul className="hidden gap-1 lg:flex lg:flex-col">
        {items.map((item) => (
          <li key={item.href}>
            <Row item={item} current={isCurrent(pathname, item.href)} />
          </li>
        ))}
      </ul>

      {/* Narrow: one scrollable row, no menu to open first. */}
      <ul className="gi-scroll flex gap-1 overflow-x-auto pb-1 lg:hidden">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Row item={item} current={isCurrent(pathname, item.href)} compact />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Row({
  item,
  current,
  compact = false,
}: {
  item: NavItem;
  current: boolean;
  compact?: boolean;
}) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={current ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        compact ? 'whitespace-nowrap' : ''
      } ${
        current
          ? 'bg-accent-faint text-accent'
          : 'text-ink-muted hover:bg-surface-inset hover:text-ink'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
      {item.badge !== undefined && (
        <span className="ml-auto rounded-full bg-surface-inset px-1.5 py-0.5 text-2xs font-semibold text-ink-muted">
          {item.badge}
        </span>
      )}
    </Link>
  );
}
