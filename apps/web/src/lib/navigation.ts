/** Shared by server guards and browser authentication flows. */
export function homePathFor(role: string): string {
  if (role === 'doctor') return '/doctor/dashboard';
  if (role === 'clinical_admin' || role === 'platform_admin') return '/admin';
  return '/patient/dashboard';
}

/** Reject network paths, backslashes and control characters before redirecting. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u0020]/.test(raw)) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith('//') || /[\\\u0000-\u0020]/.test(decoded)) return null;
    const url = new URL(raw, 'https://gi-compass.local');
    return url.origin === 'https://gi-compass.local' ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function withNext(path: string, next: string | null | undefined): string {
  const safe = safeNext(next);
  return safe === null ? path : `${path}?next=${encodeURIComponent(safe)}`;
}
