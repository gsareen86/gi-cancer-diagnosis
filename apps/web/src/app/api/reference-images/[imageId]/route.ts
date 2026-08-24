import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { tables } from '@gi-compass/db';
import { database } from '@/server/db';
import { publicRoute } from '@/server/api/route-handler';
import { problem } from '@/server/api/problem';

/**
 * Serves a reference illustration.
 *
 * These are clinical illustrations, not patient content, so they are cacheable and need no
 * session — but only a *published* asset is served. An asset whose source and licence are still
 * placeholders stays a draft and returns 404 rather than putting an unlicensed clinical image in
 * front of a patient.
 *
 * TODO(confirm): Decision D — in production these come from a CDN with responsive sizes, which
 * is a hosting decision. This route is the origin behind it.
 */
export const GET = publicRoute<{ imageId: string }>(async ({ params }) => {
  const [image] = await database()
    .select()
    .from(tables.referenceImages)
    .where(eq(tables.referenceImages.key, params.imageId))
    .limit(1);

  if (!image || image.status !== 'published') {
    return problem('not_found', 'error.not_found');
  }

  // Storage delivery is a deployment concern; the redirect keeps the binary out of the app
  // server's request path and lets a CDN answer it.
  return NextResponse.redirect(new URL(`/reference/${image.storageKey}`, 'http://localhost'), 302);
});
