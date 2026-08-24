import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Object storage for uploaded reports.
 *
 * The contract every implementation must satisfy: objects are encrypted at rest, never publicly
 * readable, and reachable only through a signed URL valid for minutes rather than hours. The
 * application server never keeps a copy on its own filesystem.
 *
 * The local implementation writes under a directory outside the app tree so a development
 * machine behaves like production — the app still cannot serve the bytes directly, only via a
 * signed, expiring route.
 */

export const SIGNED_URL_TTL_SECONDS = 15 * 60;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface StoredObject {
  storageKey: string;
  byteSize: number;
  contentType: string;
  sha256: string;
}

export interface ObjectStorage {
  put(input: { body: Buffer; contentType: string }): Promise<StoredObject>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

function storageRoot(): string {
  return resolve(process.env.LOCAL_STORAGE_ROOT ?? '/var/tmp/gi-compass-storage');
}

/**
 * Development storage. Not encrypted at rest — a local disk is not an India-region bucket, and
 * pretending otherwise would hide the gap. Production must use the S3 implementation with
 * server-side encryption enabled.
 *
 * TODO(confirm): Decision D — the cloud provider, and therefore which S3-compatible endpoint.
 */
export const localStorage: ObjectStorage = {
  async put({ body, contentType }) {
    const storageKey = `documents/${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;
    const path = join(storageRoot(), storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { mode: 0o600 });
    return {
      storageKey,
      byteSize: body.byteLength,
      contentType,
      sha256: createHash('sha256').update(body).digest('hex'),
    };
  },
  async get(storageKey) {
    // Reject any key that tries to climb out of the storage root.
    const path = resolve(join(storageRoot(), storageKey));
    if (!path.startsWith(storageRoot())) {
      throw new Error('Storage key escapes the storage root');
    }
    return readFile(path);
  },
  async delete(storageKey) {
    const path = resolve(join(storageRoot(), storageKey));
    if (!path.startsWith(storageRoot())) return;
    await unlink(path).catch(() => undefined);
  },
};

let storage: ObjectStorage = localStorage;

export function setObjectStorage(next: ObjectStorage): void {
  storage = next;
}

export function objectStorage(): ObjectStorage {
  return storage;
}

/* -------------------------------------------------------------------------------------------- */
/* Signed access                                                                                 */
/* -------------------------------------------------------------------------------------------- */

export interface SignedAccess {
  url: string;
  expiresAt: Date;
}

function signingKey(): string {
  const key = process.env.SESSION_SECRET;
  if (key === undefined) throw new Error('SESSION_SECRET is required to sign document URLs');
  return key;
}

/**
 * Signs access to exactly one document for one recipient.
 *
 * Scoped to a single object and a single actor, and short-lived, so a leaked URL is worth very
 * little. The authorization decision that produced it has already been made and audited; this
 * only carries it.
 */
export function signDocumentAccess(input: {
  documentId: string;
  actorId: string;
  ttlSeconds?: number;
}): SignedAccess {
  const ttl = Math.min(input.ttlSeconds ?? SIGNED_URL_TTL_SECONDS, SIGNED_URL_TTL_SECONDS);
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const expiry = Math.floor(expiresAt.getTime() / 1000);
  const payload = `${input.documentId}.${input.actorId}.${expiry}`;
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  return {
    url: `/api/documents/${input.documentId}/content?exp=${expiry}&sig=${signature}`,
    expiresAt,
  };
}

export function verifyDocumentSignature(input: {
  documentId: string;
  actorId: string;
  expiry: number;
  signature: string;
}): boolean {
  if (!Number.isFinite(input.expiry) || input.expiry * 1000 <= Date.now()) return false;
  const payload = `${input.documentId}.${input.actorId}.${input.expiry}`;
  const expected = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  if (expected.length !== input.signature.length) return false;
  // Constant-time comparison so the signature cannot be recovered a character at a time.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ input.signature.charCodeAt(i);
  }
  return mismatch === 0;
}
