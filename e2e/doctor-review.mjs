import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, createFixture, fixtureCode } from './support/local-fixture.mjs';

/** Synthetic local records only; real password/TOTP login, never a session bypass. */
const fixture = createFixture();
const messages = JSON.parse(readFileSync('apps/web/messages/en.json', 'utf8'));
const t = messages.doctor;
const SHOTS = process.env.SHOTS ?? 'var/tmp/clinical-screenshots';
const confirmSyntheticRelease = process.env.CONFIRM_SYNTHETIC_RELEASE === '1';
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
async function signIn(email, path, isDoctor) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(BASE + '/login?next=' + encodeURIComponent(path));
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(fixture.password);
  await page.locator('button[type=submit]').click();
  if (isDoctor) {
    await page.waitForURL('**/mfa?**');
    await page.locator('#code').fill(fixtureCode());
    await page.locator('button[type=submit]').click();
  }
  await page.waitForURL(BASE + path);
  return page;
}
async function action(page, button, path) {
  const response = page.waitForResponse((response) => response.url().endsWith(path) && response.request().method() !== 'GET');
  await button.click();
  assert.equal((await response).status(), 200);
}
try {
  const doctor = await signIn(fixture.doctor.email, '/doctor/case/' + fixture.caseId, true);
  await doctor.locator('[data-case-navigator]').waitFor({ state: 'visible' });
  await doctor.getByRole('tab', { name: t.panelReview, exact: true }).click();
  await doctor.locator('#impression').waitFor({ state: 'visible' });
  assert.equal(await doctor.locator('[data-case-navigator]').count(), 1);
  await doctor.screenshot({ path: join(SHOTS, '01-navigator-review.png'), fullPage: true });
  const draft = 'Synthetic physician-approved patient summary for testing; not medical advice.';
  await doctor.locator('#patient-summary').fill(draft);
  await doctor.locator('#notes').fill('PRIVATE-QA-NOTE');
  await doctor.locator('#prescription-instructions').fill('Synthetic physician prescription field. Not for treatment.');
  await doctor.setViewportSize({ width: 900, height: 900 });
  await doctor.getByRole('tab', { name: t.panelReview, exact: true }).click();
  assert.equal(await doctor.locator('#patient-summary').inputValue(), draft);
  await doctor.getByRole('tab', { name: t.panelRecord, exact: true }).click();
  await doctor.getByRole('tab', { name: t.panelRecord, exact: true }).press('End');
  assert.equal(await doctor.getByRole('tab', { name: t.panelReview, exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await doctor.locator('#patient-summary').inputValue(), draft);
  await doctor.screenshot({ path: join(SHOTS, '02-tabbed-review.png'), fullPage: true });
  const reviewApi = '/api/doctor/cases/' + fixture.caseId + '/review';
  await action(doctor, doctor.getByRole('button', { name: t.finalize, exact: true }), reviewApi);
  const dispatch = doctor.getByRole('button', { name: t.signAndDispatch, exact: true });
  await doctor.locator('#patient-summary').fill(draft + ' Updated.');
  assert.equal(await dispatch.isDisabled(), true);
  await action(doctor, doctor.getByRole('button', { name: t.finalize, exact: true }), reviewApi);
  await dispatch.click();
  await doctor.getByRole('dialog').waitFor({ state: 'visible' });
  assert.ok((await doctor.getByRole('dialog').innerText()).includes(draft + ' Updated.'));
  await doctor.screenshot({ path: join(SHOTS, '03-release-confirmation.png'), fullPage: true });
  if (!confirmSyntheticRelease) {
    await doctor.getByRole('button', { name: messages.app.cancel, exact: true }).click();
    await doctor.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await doctor.locator('#patient-summary').isDisabled(), false);
    assert.deepEqual(errors, []);
    console.log('Safe doctor walkthrough passed through exact release confirmation; dispatch was cancelled. Screenshots:', SHOTS);
  } else {
    // Opt-in only: this is still a medical release action, even though the fixture is synthetic.
    await action(doctor, doctor.getByRole('button', { name: t.releaseConfirm, exact: true }), '/api/doctor/cases/' + fixture.caseId + '/release');
    await doctor.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await doctor.locator('#patient-summary').isDisabled(), true);
    const patient = await signIn(fixture.patient.email, '/patient/case/' + fixture.caseId, false);
    assert.ok((await patient.locator('main').innerText()).includes(draft + ' Updated.'));
    assert.ok(!(await patient.content()).includes('PRIVATE-QA-NOTE'));
    assert.ok(!(await patient.content()).includes('synthetic-qa'));
    const download = patient.waitForEvent('download');
    await patient.locator('a[href="/api/cases/' + fixture.caseId + '/summary/pdf"]').click();
    assert.match((await download).suggestedFilename(), /\.pdf$/);
    await patient.setViewportSize({ width: 390, height: 844 });
    assert.ok(await patient.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await patient.screenshot({ path: join(SHOTS, '04-patient-summary-mobile.png'), fullPage: true });
    await patient.goto(BASE + '/doctor/dashboard');
    await patient.waitForURL('**/patient/dashboard?denied=1');
    await patient.getByRole('button', { name: messages.shell.openAccountMenu, exact: true }).click();
    await patient.getByRole('menuitem', { name: messages.shell.signOut, exact: true }).click();
    await patient.waitForURL('**/login');
    await patient.goto(BASE + '/patient/records');
    await patient.waitForURL('**/login?next=**');
    assert.deepEqual(errors, []);
    console.log('Opt-in doctor/patient release walkthrough passed. Screenshots:', SHOTS);
  }
} finally {
  await browser.close();
}
