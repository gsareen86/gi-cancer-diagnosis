'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/**
 * Explains a cross-role redirect.
 *
 * The workspace guard is a server-side `redirect()`, which is the right shape — it runs before
 * any page renders and cannot be skipped — but a redirect that silently lands somewhere else
 * reads as a bug. So the guard appends `?denied=1` and this raises a toast for it.
 *
 * A query parameter rather than a flash-message table: the message is one bit of information
 * with no server state behind it, and it is stripped from the URL immediately so a bookmark or a
 * page reload does not replay it.
 */
export function AccessDeniedToast({ message }: { message: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (params.get('denied') !== '1' || shown.current) return;
    shown.current = true;

    toast({ message, tone: 'urgent' });

    const next = new URLSearchParams(params.toString());
    next.delete('denied');
    const query = next.toString();
    router.replace(query === '' ? pathname : `${pathname}?${query}`);
  }, [params, pathname, router, toast, message]);

  return null;
}
