import { describe, expect, it } from 'vitest';
import { riskTier } from '../apps/web/src/lib/risk';
import { hoursWaiting, slaState } from '../apps/web/src/lib/sla';
import { homePathFor, safeNext, withNext } from '../apps/web/src/lib/navigation';
import { completedStages } from '../apps/web/src/lib/intake-stages';
import { inspectUpload } from '../apps/web/src/server/services/file-inspection';
import { summaryPdf } from '../apps/web/src/server/services/summary-pdf';
import { filterTriageRows, triageMetrics, type TriageFilters } from '../apps/web/src/lib/triage';
import { clinicalCategories } from '../apps/web/src/lib/clinical-category';
import { milestoneStates } from '../apps/web/src/lib/case-timeline';
import type { TriageRow } from '../apps/web/src/server/services/triage-service';

describe('clinical workspace boundaries', () => {
  const now = new Date('2026-09-04T12:00:00Z');
  const row = (id: string, status: string, highestUrgency: string | null = null): TriageRow => ({ id, caseReference: 'GC100001', patientReference: 'GI100001', status, highestUrgency, entryPoint: 'Bowel', entryPointId: 'ep_bowel', createdAt: '2026-09-01T12:00:00Z', submittedAt: '2026-09-01T12:00:00Z', flagCount: 0, aiSkipReason: null, patientName: 'Example', ageYears: 50, sex: 'female', snapshot: null, assigned: true, categories: ['ibd'] });
  const filters: TriageFilters = { query: '', risk: 'any', queue: 'all', area: 'any', category: 'any', sla: 'any', from: '', to: '' };
  it('keeps every metric consistent with its queue, including overdue reviews in progress', () => {
    const rows = [row('a', 'submitted'), row('b', 'in_review'), row('c', 'reviewed'), row('d', 'released'), row('e', 'closed')];
    const metrics = triageMetrics({ assigned: rows, claimable: [] }, (at) => slaState(at, now) === 'breached');
    for (const queue of ['pending', 'reviewed', 'closed', 'overdue'] as const) expect(filterTriageRows(rows, { ...filters, queue }, now)).toHaveLength(metrics[queue]);
    expect(metrics.overdue).toBe(2);
    expect(filterTriageRows(rows, { ...filters, sla: 'breached' }, now).map((entry) => entry.id)).toEqual(['a', 'b']);
  });
  it('combines search, risk, category and inclusive dates and sorts risk before waiting time', () => {
    const critical = { ...row('critical', 'submitted', 'emergency'), submittedAt: '2026-09-02T12:00:00Z' };
    const rows = [row('routine', 'submitted'), critical];
    expect(filterTriageRows(rows, filters, now)[0]?.id).toBe('critical');
    expect(filterTriageRows(rows, { ...filters, query: 'Example', risk: 'critical', category: 'ibd', from: '2026-09-02', to: '2026-09-02' }, now)).toEqual([critical]);
    expect(filterTriageRows(rows, { ...filters, query: 'no match' }, now)).toEqual([]);
  });
  it('derives category facets from known taxonomy without inventing diagnoses', () => {
    expect(clinicalCategories(["Crohn's disease"], 'ep_bowel')).toEqual(['ibd']);
    expect(clinicalCategories([], 'ep_bleeding')).toEqual(['gi_bleed']);
    expect(clinicalCategories(['unvalidated condition'], 'ep_bowel')).toEqual(['other']);
  });
  it('does not present skipped or pending AI as completed analysis', () => {
    expect(milestoneStates('in_review', 'skipped').find((item) => item.id === 'analysis')?.state).toBe('skipped');
    expect(milestoneStates('in_review', 'pending').find((item) => item.id === 'analysis')?.state).toBe('upcoming');
    expect(milestoneStates('ai_processed', 'complete').find((item) => item.id === 'analysis')?.state).toBe('done');
    expect(milestoneStates('reviewed', 'complete').find((item) => item.id === 'ready')?.state).toBe('upcoming');
  });
  it.each([['emergency', 'critical'], ['urgent', 'high'], ['routine-but-flagged', 'moderate'], [null, 'routine']])('maps urgency %s to %s', (urgency, tier) => {
    expect(riskTier(urgency)).toBe(tier);
  });
  it('uses the exact 48-hour SLA and clamps future dates', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    expect(slaState(new Date(now.getTime() - 48 * 3_600_000), now)).toBe('breached');
    expect(slaState(new Date(now.getTime() - 48 * 3_600_000 + 1), now)).toBe('due_soon');
    expect(hoursWaiting(new Date(now.getTime() + 100), now)).toBe(0);
    expect(slaState(null, now)).toBe('within');
  });
  it.each(['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/%5cevil.invalid', '/%2fexample.invalid', '/\n/evil.invalid', '/%'])('rejects unsafe return path %s', (value) => {
    expect(safeNext(value)).toBeNull();
  });
  it('preserves nested paths and query through authentication', () => {
    const next = '/doctor/case/abc?panel=review';
    expect(safeNext(next)).toBe(next);
    expect(withNext('/mfa', next)).toBe('/mfa?next=%2Fdoctor%2Fcase%2Fabc%3Fpanel%3Dreview');
    expect(homePathFor('doctor')).toBe('/doctor/dashboard');
    expect(homePathFor('patient')).toBe('/patient/dashboard');
  });
  it('keeps reached intake stages when a branch opens earlier questions', () => {
    expect(completedStages('visual', 'symptoms')).toEqual(['symptoms', 'pain']);
  });
  it('accepts DICOM Part 10 content but refuses a renamed arbitrary file', () => {
    const bytes = Buffer.alloc(160);
    bytes.write('DICM', 128);
    expect(inspectUpload(bytes, 'scan.dcm')).toEqual({ ok: true, contentType: 'application/dicom' });
    expect(inspectUpload(Buffer.from('not a DICOM scan'), 'scan.dcm')).toEqual({ ok: false, reason: 'unsupported_type' });
    expect(inspectUpload(bytes, 'scan.jpg')).toEqual({ ok: false, reason: 'mismatched_extension' });
  });
  it('generates a paginated official PDF with English and Hindi without network access', async () => {
    const bytes = await summaryPdf('sample-case', {
      summary: 'Reviewed patient summary. '.repeat(180), nextSteps: ['Follow up as discussed.'],
      prescriptionInstructions: 'चिकित्सक द्वारा लिखित निर्देश', standingNotice: 'Seek care if symptoms worsen.',
    }, { title: 'Official clinical summary', prescriptions: 'दवा संबंधी निर्देश' });
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });
});
