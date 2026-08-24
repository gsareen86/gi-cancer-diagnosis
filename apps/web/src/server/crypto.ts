import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { env } from './env';

/**
 * Password hashing, field-level encryption for direct identifiers, and the one-way hashes used
 * where we need to recognise a value without being able to read it back.
 */

/**
 * Argon2id. Parameters chosen for a server that also runs the app: 19 MiB and two passes is the
 * usual interactive baseline, and raising the cost is a config change rather than a rewrite.
 */
const ARGON_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  // An account seeded with an unusable hash must never verify, whatever is supplied.
  if (hash.startsWith('unusable:')) return false;
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
}

/** Recognises a value without storing it: used for emails in the rate limiter and for tokens. */
export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/* -------------------------------------------------------------------------------------------- */
/* Field-level encryption for direct identifiers                                                 */
/* -------------------------------------------------------------------------------------------- */

function key(): Buffer {
  // The configured secret is stretched to a 32-byte key so operators can supply a passphrase
  // without us silently truncating or padding it.
  return createHash('sha256').update(env().FIELD_ENCRYPTION_KEY).digest();
}

const ENCRYPTION_PREFIX = 'v1';

/**
 * AES-256-GCM. The name, phone number, and emergency contact are direct identifiers under DPDP;
 * they are encrypted before they reach the database so a database dump alone does not identify
 * anyone.
 */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

export function decryptField(encoded: string): string {
  const [version, ivPart, tagPart, dataPart] = encoded.split('.');
  if (version !== ENCRYPTION_PREFIX || !ivPart || !tagPart || !dataPart) {
    throw new Error('Encrypted field is malformed or was written by an unknown key version');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function encryptOptional(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === '' ? null : encryptField(value);
}

export function decryptOptional(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === '' ? null : decryptField(value);
}
