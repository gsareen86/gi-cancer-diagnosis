import { z } from 'zod';
import { registerPatient } from '@/server/auth/accounts';
import { queueNotification } from '@/server/services/notification-service';
import { jsonBody, publicRoute } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

const body = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
});

/**
 * Registration.
 *
 * The response is identical whether or not the address already has an account: an
 * unauthenticated caller must not be able to use this endpoint to discover who is a patient
 * here. Only the side effects differ.
 */
export const POST = publicRoute(async ({ request }) => {
  const input = await jsonBody(request, body);
  const result = await registerPatient(input);

  if (result.status === 'rejected') {
    return problem('invalid_request', 'auth.register.password_rejected', {
      problems: result.problems,
    });
  }

  if (result.status === 'created') {
    await queueNotification({
      userId: result.userId,
      type: 'email_verification',
      // The token travels in the email only. It is never returned in this response, or a
      // registration request would be enough to take over an address someone else owns.
      token: result.verificationToken,
    });
  }

  return ok({ status: 'verification_sent' }, 202);
});
