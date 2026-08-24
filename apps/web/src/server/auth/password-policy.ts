/**
 * Password policy.
 *
 * Length first, because it is the only rule that reliably helps. The breached-password list is
 * the other rule that matters: a 14-character password that appears in every credential dump is
 * worse than a shorter one nobody has seen.
 */

export const MINIMUM_PASSWORD_LENGTH = 12;
export const MAXIMUM_PASSWORD_LENGTH = 256;

/**
 * A small local list stands in for a real breached-password service. It is deliberately a
 * seam: the production deployment should point `isBreached` at a k-anonymity range API so the
 * password itself never leaves this process.
 *
 * TODO(confirm): choose a breached-password source before public launch.
 */
const LOCALLY_KNOWN_BREACHED = new Set(
  [
    'password', 'password1', 'password123', 'passw0rd', '123456', '12345678', '123456789',
    '1234567890', 'qwerty', 'qwerty123', 'letmein', 'welcome', 'welcome123', 'admin',
    'admin123', 'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football',
    'abc123', 'password@123', 'india123', 'hospital', 'doctor123', 'changeme',
    'trustno1', 'master', 'qwertyuiop', 'p@ssw0rd', 'p@ssword123', 'secret',
  ].map((value) => value.toLowerCase()),
);

export type PasswordProblemCode =
  | 'too_short'
  | 'too_long'
  | 'breached'
  | 'contains_email'
  | 'whitespace_only';

export interface PasswordProblem {
  code: PasswordProblemCode;
  /** i18n catalogue key — the message the patient sees is localized, not built here. */
  messageKey: string;
  params?: Record<string, string | number>;
}

export function isBreached(password: string): boolean {
  const normalized = password.toLowerCase().trim();
  if (LOCALLY_KNOWN_BREACHED.has(normalized)) return true;
  // Catches the "known password plus a couple of characters" pattern the raw list misses.
  return [...LOCALLY_KNOWN_BREACHED].some(
    (known) => known.length >= 6 && normalized.startsWith(known) && normalized.length <= known.length + 3,
  );
}

export function checkPassword(password: string, email?: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];

  if (password.trim().length === 0) {
    problems.push({ code: 'whitespace_only', messageKey: 'password.problem.whitespace_only' });
    return problems;
  }
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    problems.push({
      code: 'too_short',
      messageKey: 'password.problem.too_short',
      params: { minimum: MINIMUM_PASSWORD_LENGTH },
    });
  }
  if (password.length > MAXIMUM_PASSWORD_LENGTH) {
    problems.push({
      code: 'too_long',
      messageKey: 'password.problem.too_long',
      params: { maximum: MAXIMUM_PASSWORD_LENGTH },
    });
  }
  if (isBreached(password)) {
    problems.push({ code: 'breached', messageKey: 'password.problem.breached' });
  }
  const localPart = email?.split('@')[0]?.toLowerCase();
  if (localPart !== undefined && localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
    problems.push({ code: 'contains_email', messageKey: 'password.problem.contains_email' });
  }

  return problems;
}
