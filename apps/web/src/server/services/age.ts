/**
 * Age in whole years from an ISO date string.
 *
 * Whole years, computed in UTC. Two red-flag rules and the adults-only gate depend on this, so a
 * timezone-dependent answer would make triage vary by where the server happens to run.
 */
export function ageInYears(dateOfBirth: string | null | undefined, asOf = new Date()): number | null {
  if (dateOfBirth === null || dateOfBirth === undefined || dateOfBirth === '') return null;
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;

  let years = asOf.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = asOf.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < born.getUTCDate())) {
    years -= 1;
  }
  return years < 0 ? null : years;
}
