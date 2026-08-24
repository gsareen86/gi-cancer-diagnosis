import { z } from 'zod';
import { completePasswordReset } from '@/server/auth/accounts';
import { jsonBody, publicRoute } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

const body = z.object({
  token: z.string().min(10).max(512),
  password: z.string().min(1).max(256),
});

export const POST = publicRoute(async ({ request }) => {
  const input = await jsonBody(request, body);
  const outcome = await completePasswordReset(input.token, input.password);

  if (outcome.status === 'rejected') {
    return problem('invalid_request', 'auth.reset.password_rejected', { problems: outcome.problems });
  }
  if (outcome.status === 'invalid_token') {
    return problem('invalid_request', 'auth.reset.invalid_token');
  }
  return ok({ status: 'password_reset' });
});
