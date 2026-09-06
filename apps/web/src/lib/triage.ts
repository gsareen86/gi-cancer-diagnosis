import { RISK_ORDER, riskTier, type RiskTier } from './risk';
import { hoursWaiting, isBreached, slaState } from './sla';
import type { TriageRow, TriageQueue } from '../server/services/triage-service';
import type { ClinicalCategory } from './clinical-category';

export const PENDING_REVIEW_STATUSES = ['submitted', 'ai_processing', 'ai_processed', 'ai_skipped'];
export const needsReview = (status: string) => PENDING_REVIEW_STATUSES.includes(status) || status === 'in_review';
export type QueueFilter = 'all' | 'pending' | 'in_review' | 'released' | 'overdue' | 'reviewed' | 'closed';
export interface TriageFilters {
  query: string;
  risk: RiskTier | 'any';
  queue: QueueFilter;
  area: string;
  category: ClinicalCategory | 'any';
  sla: 'any' | 'breached' | 'due_soon';
  from: string;
  to: string;
}

export function filterTriageRows(rows: TriageRow[], filters: TriageFilters, now: Date): TriageRow[] {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.risk !== 'any' && riskTier(row.highestUrgency) !== filters.risk) return false;
    if (filters.area !== 'any' && row.entryPointId !== filters.area) return false;
    if (filters.category !== 'any' && !row.categories.includes(filters.category)) return false;
    const date = new Date(row.submittedAt ?? row.createdAt);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (filters.queue === 'pending' && !PENDING_REVIEW_STATUSES.includes(row.status)) return false;
    if (filters.queue === 'in_review' && row.status !== 'in_review') return false;
    if (filters.queue === 'reviewed' && !['reviewed', 'released', 'closed'].includes(row.status)) return false;
    if (filters.queue === 'released' && !['released', 'closed'].includes(row.status)) return false;
    if (filters.queue === 'closed' && row.status !== 'closed') return false;
    if (filters.queue === 'overdue' && !(needsReview(row.status) && isBreached(row.submittedAt, now))) return false;
    if (filters.sla !== 'any' && (!needsReview(row.status) || slaState(row.submittedAt, now) !== filters.sla)) return false;
    return !needle || [row.id, row.caseReference, row.patientReference ?? '', row.patientName ?? '', row.entryPoint, row.snapshot ?? ''].join(' ').toLowerCase().includes(needle);
  }).sort((a, b) => RISK_ORDER[riskTier(a.highestUrgency)] - RISK_ORDER[riskTier(b.highestUrgency)] ||
    hoursWaiting(b.submittedAt ?? b.createdAt, now) - hoursWaiting(a.submittedAt ?? a.createdAt, now));
}

export function triageMetrics(queue: TriageQueue, breached: (at: string | null) => boolean) {
  const rows = [...queue.assigned, ...queue.claimable];
  return {
    pending: rows.filter((row) => PENDING_REVIEW_STATUSES.includes(row.status)).length,
    inReview: rows.filter((row) => row.status === 'in_review').length,
    reviewed: rows.filter((row) => ['reviewed', 'released', 'closed'].includes(row.status)).length,
    released: rows.filter((row) => ['released', 'closed'].includes(row.status)).length,
    closed: rows.filter((row) => row.status === 'closed').length,
    overdue: rows.filter((row) => needsReview(row.status) && breached(row.submittedAt)).length,
    claimable: queue.claimable.length,
    total: rows.length,
  };
}

export type TriageMetrics = ReturnType<typeof triageMetrics>;
