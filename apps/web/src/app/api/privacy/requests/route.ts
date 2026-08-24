import { z } from 'zod';
import { tables } from '@gi-compass/db';
import { database } from '@/server/db';
import { jsonBody, route } from '@/server/api/route-handler';
import { ok } from '@/server/api/problem';

const body = z.object({
  type: z.enum(['access', 'correction', 'erasure']),
  detail: z.string().max(2000).optional(),
});

/** How long we have to fulfil a request. Recorded per request, so an overdue one is visible. */
const FULFILMENT_DAYS = 30;

/**
 * Records a data-subject request.
 *
 * Deliberately a recorded request rather than an immediate action — an erasure while a case is
 * under review has to wait for that clinical obligation to be discharged, and an export has to be
 * assembled and checked before it is sent. Phase 1 fulfils these through an operator with the
 * request record as the tracking artefact.
 *
 * TODO(confirm): Decision F — the fulfilment SLA, alongside the retention periods.
 */
export const POST = route({ roles: ['patient'] }, async ({ request, session }) => {
  const input = await jsonBody(request, body);

  const [created] = await database()
    .insert(tables.dataSubjectRequests)
    .values({
      userId: session.userId,
      type: input.type,
      // Erasure needs an explicit second confirmation before anything is removed.
      status: input.type === 'erasure' ? 'awaiting_confirmation' : 'received',
      detail: input.detail ?? null,
      dueBy: new Date(Date.now() + FULFILMENT_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning({ id: tables.dataSubjectRequests.id, dueBy: tables.dataSubjectRequests.dueBy });

  return ok({ id: created?.id ?? '', dueBy: created?.dueBy ?? null }, 201);
});
