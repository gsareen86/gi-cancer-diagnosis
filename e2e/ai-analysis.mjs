import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import { provisionCase, resolveDoctor } from './support/test-doctor.mjs';
import { has, visibleText } from './support/page-text.mjs';

/**
 * The doctor asking for an AI analysis from the review screen.
 *
 * The automatic run after submission is fire-and-forget, so when it fails there is nothing on
 * screen but an absence. This covers the path that fixes that: the button, the failure reason
 * when there is one, and the structured panel when there is not.
 */

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS ?? '/tmp/gi-ai';

// Brings its own account, for the same reason as the onboarding walkthrough: enrolment replaces
// any existing second factor, and a script must not do that to a real person's account.
console.log('0. account');
const { email: EMAIL, password: PASSWORD, provisioned } = resolveDoctor();
// And its own case: a brand-new doctor's queue is empty, and waiting for someone else's case to
// appear would make this run depend on whatever happens to be in the database.
if (provisioned) provisionCase(EMAIL);

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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
page.on('pageerror', (error) => console.log('  PAGEERROR:', error.message.slice(0, 200)));

const shot = async (name) => {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`  → ${name}.png`);
};

console.log('1. sign in and enrol a second factor');
await page.goto(`${BASE}/login`);
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL('**/mfa', { timeout: 15000 });

await page.click('button:has-text("Cannot scan")');
await page.waitForSelector('.font-mono');
const secret = (await page.textContent('.font-mono'))?.replace(/\s/g, '') ?? '';
await page.fill('#code', totp(secret));
await page.click('button[type=submit]');
await page.waitForURL('**/doctor/queue', { timeout: 20000 });

console.log('2. open the case');
const claim = await page.$('button:has-text("Claim for review")');
if (claim !== null) {
  await claim.click();
  await page.waitForURL('**/doctor/cases/**', { timeout: 20000 });
} else {
  await page.click('a:has-text("Open")');
  await page.waitForURL('**/doctor/cases/**', { timeout: 20000 });
}
await page.waitForTimeout(1500);
await shot('01-before-analysis');

const before = await visibleText(page);
console.log(`   shows why there is no analysis yet: ${has(before, 'last attempt failed')}`);
console.log(`   offers the button                 : ${has(before, 'Generate AI analysis')}`);

console.log('3. press Generate AI analysis');
await page.click('button:has-text("Generate AI analysis")');
// A locally hosted 27B on an APU generates at around ten tokens a second, so a full assessment
// takes minutes. The stub answers instantly; wait as though it were the real thing.
await page.waitForSelector('text=Possibilities to consider', { timeout: 420000 });
await page.waitForTimeout(1000);
await shot('02-analysis');

const after = await visibleText(page);
for (const [label, present] of [
  ['summary for the doctor', has(after, 'Summary for you')],
  ['differential with likelihood', has(after, 'Possibilities to consider')],
  ['supporting findings', has(after, 'Supporting')],
  ['concerns the model raised', has(after, 'Concerns the model raised')],
  ['suggested investigations', has(after, 'Suggested investigations')],
  // The recorded model name comes from the service's LOCAL_MODEL_NAME, not the stub's own id.
  ['version pins', /Model .+ · prompt .+ · knowledge base/i.test(after)],
  ['disclaimer', has(after, 'not a medical diagnosis')],
  ['stated as not a diagnosis', has(after, 'Not a diagnosis')],
]) {
  console.log(`   ${present ? 'shown' : 'MISSING'}: ${label}`);
}

console.log('4. adopt the suggested investigations into the doctor’s own next steps');
await page.click('button:has-text("Use these as my next steps")');
await page.waitForTimeout(500);
const nextSteps = await page.inputValue('#next-steps');
console.log(`   next steps now: ${nextSteps.split('\n').filter(Boolean).length} line(s)`);
await shot('03-adopted');

await browser.close();
