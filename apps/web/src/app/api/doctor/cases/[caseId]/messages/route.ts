import { z } from 'zod';
import { clinical } from '@/server/db';
import { accessContext, jsonBody, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

const body = z.object({ body: z.string().min(1).max(4000) });

export const GET = route<{ caseId: string }>({ roles: ['doctor', 'patient'] }, async ({ params, session, metadata }) => {
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
  const messages = await clinical().listMessages(context, params.caseId);
  return ok({ messages: messages.map(message => ({ id: message.id, body: message.body, sentAt: message.sentAt, mine: message.senderId === session.userId })) });
});

/**
 * Messaging in the case's context.
 *
 * Deliberately a plain text field with no action that inserts assessment content: messaging must
 * not become a route around the release gate for unreviewed AI output.
 */
export const POST = route<{ caseId: string }>({ roles: ['doctor', 'patient'] }, async ({ request, params, session, metadata }) => {
  const input = await jsonBody(request, body);
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
  const message = await clinical().sendMessage(context, params.caseId, session.userId, input.body);
  return ok({ message }, 201);
});
