import { z } from 'zod';
import { requestPasswordReset } from '@/server/auth/accounts';
import { queueNotification } from '@/server/services/notification-service';
import { jsonBody, publicRoute } from '@/server/api/route-handler';
import { ok } from '@/server/api/problem';

const body = z.object({ email: z.string().email().max(320) });

/**
 * Always answers the same way. An address with no account produces no email and no error, so
 * this endpoint cannot be used to enumerate patients.
 */
export const POST = publicRoute(async ({ request }) => {
  const { email } = await jsonBody(request, body);
  const outcome = await requestPasswordReset(email);
  if (outcome.status === 'issued') {
    await queueNotification({
      userId: outcome.userId,
      type: 'password_reset',
      token: outcome.token,
    });
  }
  return ok({ status: 'reset_email_sent_if_account_exists' }, 202);
});
