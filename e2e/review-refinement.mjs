import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { BASE, createFixture, fixtureCode } from './support/local-fixture.mjs';

// Synthetic UI fixture, never a release/dispatch. Opt-in live generation uses the actual provider.
const fixture = createFixture();
const t = JSON.parse(readFileSync('apps/web/messages/en.json', 'utf8')).doctor;
const shots = 'var/tmp/review-refinement';
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let releaseRequests = 0;
  page.on('request', request => { if (request.url().endsWith('/release')) releaseRequests++; });
  await page.goto(`${BASE}/login?next=${encodeURIComponent('/doctor/case/' + fixture.caseId)}`);
  await page.locator('#email').fill(fixture.doctor.email);
  await page.locator('#password').fill(fixture.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/mfa?**');
  await page.locator('#code').fill(fixtureCode());
  await page.locator('button[type=submit]').click();
  await page.waitForURL(`${BASE}/doctor/case/${fixture.caseId}`);
  try {
    await page.locator('[data-case-navigator]').waitFor({ state: 'visible' });
  } catch (error) {
    console.error('Navigator did not render at', page.url(), '\n', (await page.locator('body').innerText()).slice(0, 2000));
    throw error;
  }
  assert.equal(await page.locator('[data-case-navigator]').count(), 1);
  assert.equal(await page.getByRole('tablist', { name: t.panelTabsLabel }).evaluate(element => getComputedStyle(element).position), 'sticky');
  await page.getByRole('tab', { name: t.panelReview, exact: true }).click();
  await page.getByRole('button', { name: t.aiAssistTitle, exact: true }).waitFor();
  const summary = page.locator('#patient-summary');
  const workup = page.locator('#workup-instructions');
  assert.equal(await summary.inputValue(), '');
  assert.equal(await workup.inputValue(), '');
  const editorHeight = await summary.evaluate(element => element.getBoundingClientRect().height);
  assert(editorHeight >= 230, `patient summary editor height was ${editorHeight}px`);
  assert.equal(await page.locator('[data-review-actions]').evaluate(element => getComputedStyle(element).position), 'static');
  await page.screenshot({ path: `${shots}/desktop.png`, fullPage: true });
  await page.getByRole('button', { name: t.aiAssistTitle, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.screenshot({ path: `${shots}/ai-preview.png`, fullPage: true });
  await dialog.getByRole('button', { name: t.aiUseSummary, exact: true }).click();
  await dialog.getByRole('button', { name: t.aiUseWorkup, exact: true }).click();
  assert.equal(await dialog.getByRole('button', { name: t.aiAppendSummary, exact: true }).isDisabled(), true);
  assert.equal(await dialog.getByRole('button', { name: t.aiAppendWorkup, exact: true }).isDisabled(), true);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: t.aiAssistTitle, exact: true }).evaluate(el => el === document.activeElement), true);
  const source = await summary.inputValue();
  assert(source.includes('Synthetic review example'));
  assert((await workup.inputValue()).includes('Review prior records'));

  const manual = 'QA clinician text, retained exactly. Not medical advice.';
  await summary.fill(manual);
  await page.locator('#diagnosis').fill('QA physician conclusion, not for treatment.');
  await page.locator('#prescription-instructions').fill('QA physician-only instructions, not for treatment.');
  await page.locator('#notes').fill('PRIVATE QA NOTE - unchanged');
  await page.getByRole('button', { name: t.aiAssistTitle, exact: true }).click();
  await dialog.getByRole('button', { name: t.aiAppendSummary, exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await summary.inputValue(), `${manual}\n\n${source}`);
  assert.equal(await page.locator('#diagnosis').inputValue(), 'QA physician conclusion, not for treatment.');
  assert.equal(await page.locator('#prescription-instructions').inputValue(), 'QA physician-only instructions, not for treatment.');
  assert.equal(await page.locator('#notes').inputValue(), 'PRIVATE QA NOTE - unchanged');
  console.log('PASS: explicit adoption, append preservation, deduplication and protected fields');

  if (process.env.RUN_LIVE_AI === '1') {
    const before = await summary.inputValue();
    await page.getByRole('button', { name: t.aiAssistTitle, exact: true }).click();
    const response = page.waitForResponse(r => r.url().endsWith('/assessment') && r.request().method() === 'POST', { timeout: 960000 });
    await dialog.getByRole('button', { name: t.assessmentRegenerate, exact: true }).click();
    assert.equal(await dialog.getByRole('button', { name: t.assessmentRunning, exact: true }).isDisabled(), true);
    assert.equal((await response).status(), 200);
    await dialog.getByRole('button', { name: t.assessmentRegenerate, exact: true }).waitFor({ timeout: 15000 });
    await page.keyboard.press('Escape');
    assert.equal(await summary.inputValue(), before);
    assert.equal(await page.locator('#notes').inputValue(), 'PRIVATE QA NOTE - unchanged');
    console.log('PASS: real AI generation from assistant, shared busy state, no automatic adoption');
  }

  await page.setViewportSize({ width: 900, height: 900 });
  await page.getByRole('tab', { name: t.panelReview, exact: true }).click();
  assert.equal(await summary.inputValue(), `${manual}\n\n${source}`);
  await page.getByRole('tab', { name: t.panelReview, exact: true }).press('Home');
  assert.equal(await page.getByRole('tab', { name: t.panelRecord, exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByRole('tab', { name: t.panelRecord, exact: true }).press('End');
  assert.equal(await summary.inputValue(), `${manual}\n\n${source}`);
  await page.locator('[role="status"] button').first().waitFor({ state: 'hidden', timeout: 7000 });
  await page.screenshot({ path: `${shots}/tabbed.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: t.panelRecord, exact: true }).click();
  assert.equal(await page.getByRole('tab', { name: t.panelRecord, exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tab', { name: t.panelReview, exact: true }).getAttribute('aria-selected'), 'false');
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: `${shots}/mobile-record.png`, fullPage: true });
  assert.equal(releaseRequests, 0);
  assert.deepEqual(errors, []);
  console.log('PASS: responsive cards, keyboard tabs, draft retention, no release requests or browser errors');
} finally { await browser.close(); }
