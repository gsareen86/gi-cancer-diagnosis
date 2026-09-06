'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRightIcon } from '@/components/ui/icons';

interface Crumb { label: string; href?: string }

export function Breadcrumbs({ root, crumbs, nav, label }: {
  root: { href: string; label: string };
  crumbs?: Crumb[] | undefined;
  nav: Crumb[];
  label: string;
}) {
  const path = usePathname();
  const t = useTranslations('shell');
  const parts = path.split('/').filter(Boolean);
  const current = nav.find((item) => item.href === path);
  const trail: Crumb[] = crumbs ?? (current ? [current] : parts[1] === 'case' || (parts[1] === 'intake' && parts[2])
    ? [
        { label: t(parts[0] === 'doctor' ? 'navTriage' : 'navRecords'), href: parts[0] === 'doctor' ? '/doctor/triage' : '/patient/records' },
        { label: t('caseLabel'), href: `/${parts[0]}/${parts[1]}/${parts[2]}` },
        ...(parts[3] === 'documents' ? [{ label: t('documentsLabel') }] : []),
      ]
    : [{ label: t(parts[1] === 'profile' ? 'profile' : parts[1] === 'privacy' ? 'privacy' : parts[1] === 'consent' ? 'consentLabel' : 'navDashboard') }]);
  return (
    <nav aria-label={label} className="hidden min-w-0 md:block">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        <li className="flex shrink-0 items-center gap-1">
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-line-strong" />
          <Link href={root.href} className="text-ink-muted hover:text-ink">{root.label}</Link>
        </li>
        {trail.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-1">
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
            {crumb.href && index < trail.length - 1
              ? <Link href={crumb.href} className="truncate text-ink-muted hover:text-ink">{crumb.label}</Link>
              : <span aria-current={index === trail.length - 1 ? 'page' : undefined} className="truncate font-medium">{crumb.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
