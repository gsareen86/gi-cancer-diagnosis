import { clinical } from '@/server/db';
import { signDocumentAccess } from '@/server/services/storage';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * Issues a short-lived signed URL for one document.
 *
 * The authorization check runs here, on every access, rather than once when a long-lived URL was
 * minted — so revoking a doctor's assignment ends their access to the file immediately.
 */
export const GET = route<{ caseId: string; documentId: string }>(
  { roles: ['patient', 'doctor'] },
  async ({ params, session, metadata }) => {
    const subjectId =
      session.role === 'patient'
        ? session.userId
        : ((await clinical().resolveCaseForSystem(params.caseId))?.patientId ?? null);
    if (subjectId === null) return problem('not_found', 'error.not_found');

    const context = accessContext(
      session,
      subjectId,
      session.role === 'doctor' ? 'share_with_assigned_doctor' : 'account_processing',
      metadata,
    );

    const document = await clinical().recordDocumentAccess(
      context,
      params.caseId,
      params.documentId,
      15 * 60,
    );

    const signed = signDocumentAccess({ documentId: document.id, actorId: session.userId });
    return ok({
      url: signed.url,
      expiresAt: signed.expiresAt,
      originalFilename: document.originalFilename,
      contentType: document.contentType,
    });
  },
);

/**
 * Removes an upload before submission.
 *
 * After submission the file is part of the clinical record; the repository refuses the deletion
 * and the patient is routed to the correction process, which preserves the original.
 */
export const DELETE = route<{ caseId: string; documentId: string }>(
  { roles: ['patient'] },
  async ({ params, session, metadata }) => {
    const context = accessContext(session, session.userId, 'account_processing', metadata);
    const deleted = await clinical().deleteDocument(context, params.caseId, params.documentId);
    if (!deleted) return problem('not_found', 'error.not_found');
    return ok({ status: 'deleted', id: deleted.id });
  },
);
