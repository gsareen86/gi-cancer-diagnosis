import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import pg from 'pg';
import { BASE } from './support/local-fixture.mjs';

const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Local database required');
const db = new pg.Client({ connectionString: databaseUrl.toString() });
await db.connect();
const messages = JSON.parse(readFileSync('apps/web/messages/en.json', 'utf8'));
const t = messages.auth;
const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
const email = `auth-walkthrough-${stamp}@example.invalid`;
const originalPassword = `${randomBytes(18).toString('base64url')}-Initial9!`;
const replacementPassword = `${randomBytes(18).toString('base64url')}-Changed9!`;
const shots = 'var/tmp/auth-workflows';
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${BASE}/register`);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(originalPassword);
  await page.getByRole('button', { name: t.registerLabel, exact: true }).click();
  await page.getByText(t.verifySent, { exact: true }).waitFor();
  await page.screenshot({ path: `${shots}/register.png`, fullPage: true });
  const user = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  assert.equal(user.rows.length, 1);
  async function replaceToken(purpose, token) {
    const hash = createHash('sha256').update(token).digest('hex');
    const result = await db.query('UPDATE one_time_tokens SET token_hash=$1 WHERE user_id=$2 AND purpose=$3 AND consumed_at IS NULL', [hash, user.rows[0].id, purpose]);
    assert.equal(result.rowCount, 1);
  }
  const verifyToken = `verify-${stamp}`;
  await replaceToken('email_verification', verifyToken);
  await page.goto(`${BASE}/verify-email?token=${verifyToken}`);
  await page.getByText(t.verifySuccess, { exact: true }).waitFor();
  await page.screenshot({ path: `${shots}/verify.png`, fullPage: true });
  await page.getByRole('link', { name: t.loginLabel, exact: true }).click();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(originalPassword);
  await page.getByRole('button', { name: t.loginLabel, exact: true }).click();
  await page.waitForURL('**/patient/profile');
  console.log('PASS: registration, verification and initial login');

  await page.context().clearCookies();
  await page.goto(`${BASE}/forgot-password`);
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: t.resetSend, exact: true }).click();
  await page.getByText(t.resetSent, { exact: true }).waitFor();
  const resetToken = `reset-${stamp}`;
  await replaceToken('password_reset', resetToken);
  await page.goto(`${BASE}/reset-password?token=${resetToken}`);
  await page.locator('#password').fill(replacementPassword);
  await page.getByRole('button', { name: t.resetSend, exact: true }).click();
  await page.waitForURL('**/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(replacementPassword);
  await page.getByRole('button', { name: t.loginLabel, exact: true }).click();
  await page.waitForURL('**/patient/profile');
  await page.screenshot({ path: `${shots}/login-after-reset.png`, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(errors, []);
  console.log('PASS: forgot-password, reset, changed-password login and mobile layout');
} finally { await browser.close(); await db.end(); }
