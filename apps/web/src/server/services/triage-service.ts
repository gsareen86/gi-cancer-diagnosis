import { inArray } from 'drizzle-orm';
import { createTextResolver } from '@gi-compass/core';
import { tables } from '@gi-compass/db';
import { clinical, database } from '../db';
import { decryptOptional } from '../crypto';
import { loadTemplateVersion } from './content-service';
import { ageInYears } from './age';
import { caseReference, patientReference } from '@/lib/references';
import { clinicalCategories, type ClinicalCategory } from '@/lib/clinical-category';

/**
 * Assembles the doctor's triage queue.
 *
 * The queue, and the AI snapshots that go with it, come from `ClinicalRepository` — the clinical
 * tables are deliberately not importable outside that package, so nothing here reaches them. This
 * module adds only what the *interface* needs to triage without opening every case: the patient's
 * age and sex, the symptom area in words, a one-line snapshot, and — for assigned cases only —
 * the patient's name.
 *
 * **Why the name is conditional.** The MVP kept the patient pseudonymous to every doctor. That is
 * right for the claimable queue, which any doctor can see: a name there is identity disclosed
 * before any clinical relationship exists. It is wrong once a doctor has taken responsibility and
 * is about to sign a clinical opinion, at which point knowing who they are writing about is the
 * job. So the name is decrypted here, server-side, only for cases assigned to the caller.
 *
 * **The snapshot is not a conclusion.** It is the first sentence of the model's clinician
 * summary, shown with decision-support labelling, and it exists so a doctor can order their own
 * work — not so they can skip reading the case.
 */

export interface TriageRow {
  id: string;
  caseReference: string;
  patientReference: string | null;
  status: string;
  entryPoint: string;
  entryPointId: string;
  createdAt: string;
  submittedAt: string | null;
  highestUrgency: string | null;
  flagCount: number;
  aiSkipReason: string | null;
  /** Null on claimable cases, by design — see above. */
  patientName: string | null;
  ageYears: number | null;
  sex: string | null;
  /** Null when no assessment exists, which the table states rather than leaving blank. */
  snapshot: string | null;
  assigned: boolean;
  categories: ClinicalCategory[];
}

interface QueueRow {
  id: string;
  publicNumber: number;
  status: string;
  entryPointId: string;
  templateVersionId: string;
  patientId: string;
  createdAt: Date;
  submittedAt: Date | null;
  aiSkipReason: string | null;
  highestUrgency: string | null;
  flagCount: number;
}

/** One sentence, capped. A snapshot that wraps to four lines is not a snapshot. */
const SNAPSHOT_MAX = 180;

function firstSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed === '') return '';
  const stop = trimmed.search(/[.!?](\s|$)/);
  const sentence = stop === -1 ? trimmed : trimmed.slice(0, stop + 1);
  return sentence.length > SNAPSHOT_MAX
    ? `${sentence.slice(0, SNAPSHOT_MAX - 1).trimEnd()}…`
    : sentence;
}

/**
 * Demographics for the queue. `users` is a non-clinical table and is exported for exactly this:
 * the name is encrypted at rest and decrypted here, at the point of response, never earlier.
 */
async function patientsFor(
  patientIds: readonly string[],
  namedPatientIds: ReadonlySet<string>,
): Promise<Map<string, { name: string | null; reference: string | null; dateOfBirth: string | null; sex: string | null }>> {
  if (patientIds.length === 0) return new Map();

  const rows = await database()
    .select({
      id: tables.users.id,
      publicNumber: tables.users.publicNumber,
      fullNameEnc: tables.users.fullNameEnc,
      dateOfBirth: tables.users.dateOfBirth,
      sex: tables.users.sex,
    })
    .from(tables.users)
    .where(inArray(tables.users.id, [...patientIds]));

  return new Map(
    rows.map((row) => [
      row.id,
      { name: namedPatientIds.has(row.id) ? decryptOptional(row.fullNameEnc) : null, reference: namedPatientIds.has(row.id) ? patientReference(row.publicNumber) : null, dateOfBirth: row.dateOfBirth, sex: row.sex },
    ]),
  );
}

/** Symptom areas resolved once per template version rather than once per case. */
async function entryPointLabels(
  versionIds: ReadonlySet<string>,
  locale: string,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  for (const versionId of versionIds) {
    const { document } = await loadTemplateVersion(versionId);
    const resolve = createTextResolver(document, locale);
    for (const entry of document.template.entryPoints) {
      labels.set(entry.id, resolve(entry.labelKey));
    }
  }
  return labels;
}

export interface TriageQueue {
  assigned: TriageRow[];
  claimable: TriageRow[];
}

export async function loadTriageQueue(doctorId: string, locale = 'en'): Promise<TriageQueue> {
  const repo = clinical();
  const [mine, unowned] = await Promise.all([
    repo.listDoctorQueue(doctorId, 'doctor'),
    // Assignment happens at submission, so a case submitted before any doctor existed has no
    // owner and would otherwise be invisible to every queue.
    repo.listClaimableCases('doctor'),
  ]);

  const assignedRows = mine as QueueRow[];
  const claimableRows = unowned as QueueRow[];
  const all = [...assignedRows, ...claimableRows];

  const [snapshots, patients, labels] = await Promise.all([
    repo.assessmentTriageSignals(
      doctorId,
      'doctor',
      all.map((row) => row.id),
    ),
    patientsFor(all.map((row) => row.patientId), new Set(assignedRows.map((row) => row.patientId))),
    entryPointLabels(new Set(all.map((row) => row.templateVersionId)), locale),
  ]);

  const decorate = (row: QueueRow, assigned: boolean): TriageRow => {
    const patient = patients.get(row.patientId);
    const summary = snapshots.get(row.id);
    return {
      id: row.id,
      caseReference: caseReference(row.publicNumber),
      patientReference: assigned ? (patient?.reference ?? null) : null,
      status: row.status,
      entryPointId: row.entryPointId,
      entryPoint: labels.get(row.entryPointId) ?? row.entryPointId,
      createdAt: row.createdAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      highestUrgency: row.highestUrgency,
      flagCount: row.flagCount,
      aiSkipReason: row.aiSkipReason,
      // The one conditional field. A claimable case stays pseudonymous.
      patientName: assigned ? (patient?.name ?? null) : null,
      ageYears: ageInYears(patient?.dateOfBirth ?? null),
      sex: patient?.sex ?? null,
      snapshot: summary === undefined ? null : firstSentence(summary.summary),
      categories: clinicalCategories(summary?.conditions ?? [], row.entryPointId),
      assigned,
    };
  };

  return {
    assigned: assignedRows.map((row) => decorate(row, true)),
    claimable: claimableRows.map((row) => decorate(row, false)),
  };
}

export { triageMetrics, type TriageMetrics } from '../../lib/triage';
