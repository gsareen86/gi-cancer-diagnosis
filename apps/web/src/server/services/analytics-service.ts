import { clinical } from '../db';

/**
 * The reviewing doctor's own numbers.
 *
 * The aggregates come from `ClinicalRepository.doctorStatistics`, which is scoped to cases
 * assigned to the caller and writes its own audit entry — the clinical tables are deliberately
 * not importable outside that package, and analytics is not an exception to that.
 *
 * Every figure here is a count or a duration. No patient identifier reaches this module at all,
 * which is what makes it safe to render on a screen a colleague might glance at.
 *
 * Cohort-level questionnaire analytics are deliberately absent: those belong in the clinical
 * admin console, where the minimum-cohort-size rule from `admin/clinical-content` applies.
 */

export interface WeeklyPoint {
  /** ISO date of the week's Monday. */
  weekStart: string;
  released: number;
}

export interface OverrideSummary {
  action: string;
  count: number;
}

export interface DoctorAnalytics {
  reviewed: number;
  released: number;
  /** Hours from submission to release, median. Null until something has been released. */
  medianHoursToRelease: number | null;
  riskDistribution: Array<{ urgency: string | null; count: number }>;
  weekly: WeeklyPoint[];
  overrides: OverrideSummary[];
  totalDifferentialItems: number;
}

const WEEKS = 8;
const MS_PER_HOUR = 3_600_000;

function mondayOf(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // `getUTCDay` puts Sunday at 0, so shift it to the end of the week rather than the start.
  const offset = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - offset);
  return copy.toISOString().slice(0, 10);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  const value =
    sorted.length % 2 === 1
      ? (sorted[(sorted.length - 1) / 2] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return Math.round(value * 10) / 10;
}

function rank(urgency: string | null): number {
  if (urgency === 'emergency') return 0;
  if (urgency === 'urgent') return 1;
  if (urgency === 'routine-but-flagged') return 2;
  return 3;
}

export async function loadDoctorAnalytics(doctorId: string): Promise<DoctorAnalytics> {
  const now = new Date();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - WEEKS * 7);

  const { cases, flags, overrides } = await clinical().doctorStatistics(doctorId, 'doctor', since);

  /* --- Time to release ---------------------------------------------------------------- */

  // Median rather than mean: one case that sat over a holiday weekend drags a mean far enough to
  // make a healthy month look broken, and the doctor reading this cannot tell which it was.
  const durations = cases
    .filter((row) => row.releasedAt !== null && row.submittedAt !== null)
    .map(
      (row) => ((row.releasedAt as Date).getTime() - (row.submittedAt as Date).getTime()) / MS_PER_HOUR,
    );

  /* --- Risk distribution -------------------------------------------------------------- */

  const highestByCase = new Map<string, string | null>(cases.map((row) => [row.id, null]));
  for (const flag of flags) {
    const current = highestByCase.get(flag.caseId) ?? null;
    if (rank(flag.urgency) < rank(current)) highestByCase.set(flag.caseId, flag.urgency);
  }

  const distribution = new Map<string | null, number>([
    ['emergency', 0],
    ['urgent', 0],
    ['routine-but-flagged', 0],
    [null, 0],
  ]);
  for (const urgency of highestByCase.values()) {
    distribution.set(urgency, (distribution.get(urgency) ?? 0) + 1);
  }

  /* --- Weekly throughput -------------------------------------------------------------- */

  const weeks: WeeklyPoint[] = [];
  for (let index = WEEKS - 1; index >= 0; index -= 1) {
    const at = new Date(now);
    at.setUTCDate(at.getUTCDate() - index * 7);
    weeks.push({ weekStart: mondayOf(at), released: 0 });
  }
  const byWeek = new Map(weeks.map((point) => [point.weekStart, point]));
  for (const row of cases) {
    if (row.releasedAt === null) continue;
    const point = byWeek.get(mondayOf(row.releasedAt));
    if (point !== undefined) point.released += 1;
  }

  return {
    reviewed: cases.filter((row) => ['reviewed', 'released', 'closed'].includes(row.status)).length,
    released: cases.filter((row) => row.releasedAt !== null).length,
    medianHoursToRelease: median(durations),
    riskDistribution: [...distribution.entries()].map(([urgency, count]) => ({ urgency, count })),
    weekly: weeks,
    overrides: overrides.map((row) => ({ action: row.action, count: row.count })),
    totalDifferentialItems: overrides.reduce((sum, row) => sum + row.count, 0),
  };
}
