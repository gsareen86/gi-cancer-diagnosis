import { z } from 'zod';
import { verifyEmail } from '@/server/auth/accounts';
import { jsonBody, publicRoute } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

const body = z.object({ token: z.string().min(10).max(512) });

export const POST = publicRoute(async ({ request }) => {
  const { token } = await jsonBody(request, body);
  const result = await verifyEmail(token);
  if (result.status !== 'consumed') {
    return problem('invalid_request', 'auth.verify.invalid_token');
  }
  return ok({ status: 'verified' });
});
