import { z } from 'zod';
import { clinical } from '@/server/db';
import { inspectUpload, scanUpload } from '@/server/services/file-inspection';
import { MAX_UPLOAD_BYTES, objectStorage } from '@/server/services/storage';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

const tagSchema = z.object({
  patientTypeTag: z.string().min(1).max(120).optional(),
  patientDateTag: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** The documents attached to a case, with their scan and extraction state. */
export const GET = route<{ caseId: string }>({ roles: ['patient', 'doctor'] }, async ({ params, session, metadata }) => {
  const subjectId = await resolveSubject(session, params.caseId, metadata);
  if (subjectId === null) return problem('not_found', 'error.not_found');

  const context = accessContext(
    session,
    subjectId,
    session.role === 'doctor' ? 'share_with_assigned_doctor' : 'account_processing',
    metadata,
  );
  const documents = await clinical().listDocuments(context, params.caseId);
  return ok({
    documents: documents.map((document) => ({
      id: document.id,
      originalFilename: document.originalFilename,
      contentType: document.contentType,
      byteSize: document.byteSize,
      scanStatus: document.scanStatus,
      patientTypeTag: document.patientTypeTag,
      patientDateTag: document.patientDateTag,
      machineReadable: document.machineReadable,
      // Marked unverified until a clinician confirms it — the original is the source of truth.
      extract: document.extract,
      extractVerified: document.extractVerifiedAt !== null,
      uploadedAt: document.uploadedAt,
    })),
  });
});

/**
 * Uploads a prior report.
 *
 * Order matters: inspect the content, scan it, and only then write it to storage. A file that
 * fails either check is never persisted and never becomes visible to the doctor. A scanner that
 * cannot be reached leaves the upload pending rather than accepted — an unreachable scanner is
 * not a clean verdict.
 */
export const POST = route<{ caseId: string }>({ roles: ['patient'] }, async ({ request, params, session, metadata }) => {
  const context = accessContext(session, session.userId, 'account_processing', metadata);
  const repo = clinical();

  const caseRecord = await repo.getCase(context, params.caseId);
  if (!caseRecord) return problem('not_found', 'error.not_found');
  if (caseRecord.status !== 'in_progress') {
    return problem('conflict', 'documents.upload.case_not_editable');
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return problem('invalid_request', 'documents.upload.file_required');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return problem('invalid_request', 'documents.upload.too_large', { maxBytes: MAX_UPLOAD_BYTES });
  }

  const tags = tagSchema.parse({
    patientTypeTag: form.get('patientTypeTag')?.toString() || undefined,
    patientDateTag: form.get('patientDateTag')?.toString() || undefined,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const inspection = inspectUpload(buffer, file.name);
  if (!inspection.ok) {
    return problem('invalid_request', `documents.upload.${inspection.reason}`);
  }

  const verdict = await scanUpload(buffer);
  if (verdict === 'infected') {
    // Discarded outright: never stored, never referenced, never retrievable.
    return problem('invalid_request', 'documents.upload.infected');
  }

  const stored = await objectStorage().put({ body: buffer, contentType: inspection.contentType });

  const document = await repo.attachDocument(context, {
    caseId: params.caseId,
    originalFilename: file.name.slice(0, 255),
    contentType: inspection.contentType,
    byteSize: stored.byteSize,
    storageKey: stored.storageKey,
    scanStatus: verdict,
    patientTypeTag: tags.patientTypeTag ?? null,
    patientDateTag: tags.patientDateTag ?? null,
  });

  return ok(
    {
      document: {
        id: document?.id ?? '',
        originalFilename: file.name,
        contentType: inspection.contentType,
        byteSize: stored.byteSize,
        scanStatus: verdict,
      },
      // A pending scan is surfaced rather than hidden: the patient should know the file is not
      // yet available to their doctor.
      pendingScan: verdict === 'scanner_unavailable',
    },
    201,
  );
});

async function resolveSubject(
  session: { userId: string; role: string },
  caseId: string,
  metadata: { ipHash: string | null; userAgent: string | null },
): Promise<string | null> {
  if (session.role === 'patient') return session.userId;
  const resolved = await clinical().resolveCaseForSystem(caseId);
  void metadata;
  return resolved?.patientId ?? null;
}
