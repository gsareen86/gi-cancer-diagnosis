import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238).
 *
 * Implemented here rather than pulled in, because it is forty lines of well-specified arithmetic
 * and the alternative is a dependency inside the authentication path for accounts that can read
 * patient records.
 *
 * Deliberately plain TOTP over HMAC-SHA1 with 6 digits and a 30-second step — what every
 * authenticator app assumes when a URI omits the parameters.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;
const SECRET_BYTES = 20;

/**
 * How far either side of now a code is accepted. One step covers a phone clock that has drifted
 * by up to thirty seconds; more than that turns a stolen code into a usable one for minutes.
 */
const ACCEPTED_DRIFT_STEPS = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(encoded: string): Buffer {
  const normalized = encoded.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error('Secret is not valid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateSecret(): string {
  return encodeBase32(randomBytes(SECRET_BYTES));
}

/** The code for one 30-second step. Exported so tests can pin a moment in time. */
export function codeForStep(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  // Big-endian 64-bit counter. writeBigUInt64BE keeps it exact past 2038.
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac('sha1', decodeBase32(secretBase32)).update(counter).digest();
  // Dynamic truncation, RFC 4226 §5.3.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function currentStep(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / PERIOD_SECONDS);
}

/**
 * Checks a submitted code against the accepted drift window.
 *
 * Compared in constant time so a wrong code takes the same time whatever its first digits.
 */
export function verifyCode(
  secretBase32: string,
  submitted: string,
  atMs: number = Date.now(),
): boolean {
  const cleaned = submitted.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;

  const step = currentStep(atMs);
  for (let drift = -ACCEPTED_DRIFT_STEPS; drift <= ACCEPTED_DRIFT_STEPS; drift += 1) {
    const expected = codeForStep(secretBase32, step + drift);
    const a = Buffer.from(expected);
    const b = Buffer.from(cleaned);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/**
 * The `otpauth://` URI an authenticator app scans.
 *
 * The label carries the account's email so a clinician with several accounts can tell them apart,
 * and the issuer names the service. Neither is a secret.
 */
export function enrolmentUri(options: {
  secretBase32: string;
  accountEmail: string;
  issuer?: string;
}): string {
  const issuer = options.issuer ?? 'GI Compass';
  const label = `${issuer}:${options.accountEmail}`;
  const parameters = new URLSearchParams({
    secret: options.secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${parameters.toString()}`;
}

/** Grouped into blocks of four, for anyone typing the secret in by hand. */
export function formatSecretForDisplay(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, '$1 ').trim();
}

export const TOTP_PERIOD_SECONDS = PERIOD_SECONDS;
export const TOTP_DIGITS = DIGITS;
