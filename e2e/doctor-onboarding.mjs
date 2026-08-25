import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import { resolveDoctor } from './support/test-doctor.mjs';
import { has, visibleText } from './support/page-text.mjs';

/**
 * The doctor's way in: sign in, enrol a second factor, reach the review queue.
 *
 * Worth an end-to-end run because it is the one path with no self-service recovery — a clinician
 * who cannot get past enrolment cannot review anything, and there is no "skip for now".
 *
 * The TOTP code is computed here the same way an authenticator app would, from the secret the
 * enrolment step displays.
 */

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS ?? '/tmp/gi-doctor-onboarding';

// Brings its own account. Enrolment replaces whatever second factor an account has, so borrowing
// a real one would silently lock its owner out of their authenticator app.
console.log('0. account');
const { email: EMAIL, password: PASSWORD } = resolveDoctor();

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(encoded) {
  const normalized = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of normalized) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238, mirroring what a phone would produce for the same secret at the same moment. */
function totp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (error) => console.log('  PAGEERROR:', error.message.slice(0, 200)));

const shot = async (name) => {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`  → ${name}.png`);
};

console.log('1. sign in as the doctor');
await page.goto(`${BASE}/login`);
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL('**/mfa', { timeout: 15000 });
console.log('   landed on the second-factor gate, as a privileged account should');
await shot('01-mfa-gate');

console.log('2. the enrolment secret is offered for manual entry as well as scanning');
await page.click('button:has-text("Cannot scan")');
await page.waitForSelector('.font-mono', { timeout: 10000 });
const secret = (await page.textContent('.font-mono'))?.replace(/\s/g, '') ?? '';
console.log(`   secret length: ${secret.length} characters`);
await shot('02-enrolment');

console.log('3. enter the code an authenticator app would show');
await page.fill('#code', totp(secret));
await page.click('button[type=submit]');
await page.waitForURL('**/doctor/queue', { timeout: 20000 });
console.log('   reached the review queue');
await shot('03-queue');

const queue = await visibleText(page);
console.log(`   queue is empty: ${has(queue, 'Nothing waiting')}`);
console.log(`   shows a case  : ${has(queue, 'Open')}`);

console.log('4. the second factor persists — sign out and back in');
await page.goto(`${BASE}/login`);
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL('**/mfa', { timeout: 15000 });

const second = await visibleText(page);
console.log(`   asks for a code, not a fresh QR: ${has(second, 'Enter your code')}`);
await page.fill('#code', totp(secret));
await page.click('button[type=submit]');
await page.waitForURL('**/doctor/queue', { timeout: 20000 });
console.log('   signed in again with the same authenticator');
await shot('04-returning');

await browser.close();
