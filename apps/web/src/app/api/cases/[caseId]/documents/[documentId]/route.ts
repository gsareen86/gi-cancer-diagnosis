import { clinical } from '@/server/db';
import { NextResponse } from 'next/server';
import { objectStorage, signDocumentAccess, verifyDocumentSignature } from '@/server/services/storage';
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
  async ({ request, params, session, metadata }) => {
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

    if (request.nextUrl.searchParams.has('content')) {
      if (!verifyDocumentSignature({ documentId: document.id, actorId: session.userId,
        expiry: Number(request.nextUrl.searchParams.get('exp')), signature: request.nextUrl.searchParams.get('sig') ?? '' })) {
        return problem('forbidden', 'error.forbidden');
      }
      const bytes = await objectStorage().get(document.storageKey);
      return new NextResponse(new Uint8Array(bytes), { headers: {
        'Content-Type': document.contentType,
        'Content-Disposition': `${document.contentType === 'application/dicom' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(document.originalFilename)}`,
        'Cache-Control': 'private, no-store',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
      } });
    }
    const signed = signDocumentAccess({ documentId: document.id, actorId: session.userId });
    const signature = new URL(signed.url, 'http://local').search;
    return ok({
      url: `/api/cases/${params.caseId}/documents/${document.id}${signature}&content=1`,
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
