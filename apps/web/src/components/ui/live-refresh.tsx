'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Refresh server-owned status while visible; never remount an editor or store health data. */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [router]);
  return null;
}
