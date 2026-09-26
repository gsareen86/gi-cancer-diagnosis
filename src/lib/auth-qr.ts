/** Supabase returns an unescaped SVG data URL, including trailing newlines. */
export function authQrDataUrl(value: string): string {
  const prefix = "data:image/svg+xml;utf-8,";
  if (!value.startsWith(prefix))
    throw new Error("Authenticator image unavailable");
  // Encoding preserves the SVG while avoiding URL control characters and fragments.
  return prefix + encodeURIComponent(value.slice(prefix.length));
}
