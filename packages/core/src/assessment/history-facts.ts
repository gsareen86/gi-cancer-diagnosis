import { z } from 'zod';
import type { ClinicalFact } from './clinical-summary';

const text = z.string().max(4000);
const entry = z.record(z.string(), z.unknown());
/** Read boundary for legacy JSON history. Empty arrays do not assert a negative history. */
export const clinicalHistoryRecordSchema = z.object({
  conditions: z.array(entry).default([]), surgeries: z.array(entry).default([]),
  medications: z.array(entry).default([]), allergies: z.array(entry).default([]), familyHistory: z.array(entry).default([]),
  lifestyle: z.record(z.string(), z.unknown()).nullable().optional(),
  heightCm: z.number().nullable().optional(), weightKg: z.union([z.number(), text]).nullable().optional(),
  additionalNotes: text.nullable().optional(),
  trajectory: z.record(z.string(), z.unknown()).nullable().optional(),
  assertions: z.record(z.enum(['conditions', 'surgeries', 'medications', 'allergies', 'familyHistory']), z.enum(['none', 'unknown', 'provided'])).optional(),
});

function describe(record: Record<string, unknown>, keys: readonly string[]): string {
  return keys.flatMap(key => {
    if (key === 'code' && typeof record.label === 'string' && record.label.trim()) return [];
    const value = record[key];
    return typeof value === 'string' && value.trim() ? [value.trim().replace(/_/g, ' ')] : typeof value === 'number' && Number.isFinite(value) ? [String(value)] : [];
  }).join(' · ');
}

export function compileHistoryFacts(input: unknown, caseId: string): ClinicalFact[] {
  const parsed = clinicalHistoryRecordSchema.safeParse(input);
  if (!parsed.success) return [{ questionId: 'history.record', cluster: 'history', question: 'Clinical history', presence: 'indeterminate', answer: 'Not recorded or unavailable', source: { type: 'history', recordId: caseId } }];
  const history = parsed.data;
  const facts: ClinicalFact[] = [];
  const append = (id: string, question: string, answer: string, presence: ClinicalFact['presence'] = 'present') => {
    facts.push({ questionId: `history.${id}`, cluster: id === 'medications' || id === 'lifestyle' ? 'medication_lifestyle' : 'history', question, answer, presence, source: { type: 'history', recordId: caseId } });
  };
  const sections = [
    ['conditions', 'Medical conditions', ['label', 'code', 'sinceYear', 'notes']],
    ['surgeries', 'Previous surgery', ['label', 'code', 'year', 'notes']],
    ['medications', 'Current and previous medicines (reported history, not a prescription)', ['name', 'kind', 'frequency', 'notes']],
    ['allergies', 'Allergies', ['substance', 'reaction']],
    ['familyHistory', 'Family history', ['relation', 'condition', 'label', 'ageAtDiagnosis', 'notes']],
  ] as const;
  for (const [id, label, keys] of sections) {
    const rendered = history[id].map(item => describe(item, keys)).filter(Boolean);
    const denied = history.assertions?.[id] === 'none' && rendered.length === 0;
    append(id, label, rendered.length ? rendered.join('; ') : denied ? 'Explicitly reported none' : 'Not established', rendered.length ? 'present' : denied ? 'absent' : 'indeterminate');
  }
  if (history.lifestyle) {
    for (const key of ['smoking', 'alcohol', 'diet']) {
      const value = history.lifestyle[key];
      append(`lifestyle.${key}`, key, typeof value === 'string' ? value : 'Not established', value === 'unknown' || value == null ? 'indeterminate' : 'value');
    }
  }
  const height = history.heightCm;
  const weight = typeof history.weightKg === 'string' ? Number(history.weightKg) : history.weightKg;
  if (height != null) append('height', 'Reported height', `${height} cm`, 'value');
  if (weight != null && Number.isFinite(weight)) append('weight', 'Reported weight', `${weight} kg`, 'value');
  if (history.additionalNotes) append('notes', 'Additional reported history', history.additionalNotes);
  if (history.trajectory) for (const [key, value] of Object.entries(history.trajectory)) {
    if (typeof value === 'string' && value.trim()) append(`trajectory.${key}`, `Symptom history — ${key}`, value.trim(), value === 'unknown' ? 'indeterminate' : 'present');
  }
  return facts;
}
