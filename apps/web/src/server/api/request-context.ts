import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Request metadata for the audit trail.
 *
 * The IP address is hashed rather than stored. We need to tell "the same origin as last time"
 * from "somewhere new", which a hash answers; storing the address itself would add a direct
 * identifier to a table that deliberately holds none.
 */

export interface RequestMetadata {
  ipHash: string | null;
  userAgent: string | null;
}

export function requestMetadata(request: NextRequest): RequestMetadata {
  const forwarded = request.headers.get('x-forwarded-for');
  const address = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip');
  return {
    ipHash: address ? createHash('sha256').update(address).digest('hex').slice(0, 32) : null,
    userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  };
}
