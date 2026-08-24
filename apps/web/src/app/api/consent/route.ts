import { z } from 'zod';
import { CONSENT_PURPOSES } from '@gi-compass/core';
import { consentState, grantConsent, withdrawConsent } from '@/server/services/consent-service';
import { jsonBody, route } from '@/server/api/route-handler';
import { ok } from '@/server/api/problem';

const purposeEnum = z.enum(CONSENT_PURPOSES as unknown as [string, ...string[]]);

/** What the patient has agreed to, when, against which policy version, and what each stops. */
export const GET = route({ roles: ['patient'] }, async ({ session }) =>
  ok(await consentState(session.userId)),
);

const grantBody = z.object({ purposes: z.array(purposeEnum).min(1) });

/**
 * Grants one or more purposes.
 *
 * The client sends only the purposes the patient actively selected. Nothing is inferred: a
 * purpose absent from the list stays ungranted rather than being treated as accepted by default.
 */
export const POST = route({ roles: ['patient'] }, async ({ request, session, metadata }) => {
  const { purposes } = await jsonBody(request, grantBody);
  await grantConsent(session.userId, purposes as never, metadata);
  return ok(await consentState(session.userId));
});

const withdrawBody = z.object({ purpose: purposeEnum });

/**
 * Withdraws a purpose. Takes effect on the next processing decision — a queued AI job for this
 * patient will find no live grant and stop.
 */
export const DELETE = route({ roles: ['patient'] }, async ({ request, session }) => {
  const { purpose } = await jsonBody(request, withdrawBody);
  const withdrawn = await withdrawConsent(session.userId, purpose as never);
  return ok({ withdrawn, ...(await consentState(session.userId)) });
});
