import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE, createFixture, fixtureCode } from './support/local-fixture.mjs';

const fixture = createFixture();
const messages = JSON.parse(readFileSync('apps/web/messages/en.json', 'utf8'));
const browser = await chromium.launch();
const errors = [];
async function keyboardReachable(page, label, modal = false) {
  if (modal) await page.getByRole('dialog').focus();
  else await page.locator('body').click({ position: { x: 1, y: 1 } });
  const controls = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]';
  const expected = await (modal ? page.getByRole('dialog').locator(controls) : page.locator(controls)).evaluateAll((nodes, auditLabel) => {
    const output = [];
    let serial = 0;
    for (const node of nodes) {
      const element = /** @type {HTMLElement} */ (node);
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.getClientRects().length === 0) continue;
      if (element.closest('[inert]') || element.tabIndex < 0) continue;
      if (element.closest('[role="dialog"]') === null && document.querySelector('[role="dialog"]')) continue;
      const id = `${auditLabel}-${serial++}`;
      element.dataset.keyboardAudit = id;
      const labelledBy = element.getAttribute('aria-labelledby');
      const name = element.getAttribute('aria-label') ||
        (labelledBy ? document.getElementById(labelledBy)?.innerText : '') ||
        (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText : '') ||
        element.closest('label')?.innerText || element.innerText || element.getAttribute('name') || element.id;
      output.push({ id, name: name.trim().slice(0, 80), tag: element.tagName, html: element.outerHTML.slice(0, 240) });
    }
    return output;
  }, label);
  assert(expected.length > 0, `${label}: no visible controls found`);
  assert.deepEqual(expected.filter(item => !item.name), [], `${label}: unnamed keyboard control`);
  const reached = new Set();
  if (modal) await page.getByRole('dialog').focus();
  else await page.locator('body').evaluate(body => { body.tabIndex = -1; body.focus(); });
  for (let i = 0; i < expected.length + 8; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement?.getAttribute('data-keyboard-audit'));
    if (id) reached.add(id);
  }
  const missing = expected.filter(item => !reached.has(item.id));
  assert.deepEqual(missing, [], `${label}: controls missing from Tab order`);
  console.log(`PASS: ${label} (${expected.length} keyboard controls)`);
}
async function login(page, email, password, doctor = false) {
  await page.goto(`${BASE}/login`);
  await keyboardReachable(page, doctor ? 'doctor login' : 'patient login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: messages.auth.loginLabel, exact: true }).press('Enter');
  if (doctor) {
    await page.waitForURL('**/mfa*');
    await keyboardReachable(page, 'doctor MFA');
    await page.locator('#code').fill(fixtureCode());
    await page.locator('button[type=submit]').press('Enter');
  }
}
try {
  const doctor = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  doctor.on('pageerror', error => errors.push(error.message));
  await login(doctor, fixture.doctor.email, fixture.password, true);
  for (const route of ['/doctor/dashboard', '/doctor/triage', '/doctor/analytics', '/doctor/notifications', `/doctor/case/${fixture.caseId}`]) {
    await doctor.goto(BASE + route);
    await doctor.locator('main').waitFor();
    await keyboardReachable(doctor, route);
  }
  await doctor.getByRole('button', { name: messages.shell.openAccountMenu, exact: true }).focus();
  await doctor.keyboard.press('Enter');
  await doctor.getByRole('menu').waitFor();
  await doctor.keyboard.press('ArrowDown');
  assert(await doctor.getByRole('menuitem').evaluateAll(items => items.includes(document.activeElement)));
  await doctor.keyboard.press('Escape');
  console.log('PASS: account menu Enter/Arrow/Escape');

  await doctor.goto(`${BASE}/doctor/case/${fixture.caseId}`);
  await doctor.getByRole('button', { name: messages.doctor.aiAssistTitle, exact: true }).focus();
  await doctor.keyboard.press('Enter');
  const dialog = doctor.getByRole('dialog');
  await dialog.waitFor();
  await keyboardReachable(doctor, 'AI assistant modal', true);
  await doctor.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert(await doctor.getByRole('button', { name: messages.doctor.aiAssistTitle, exact: true }).evaluate(el => el === document.activeElement));
  console.log('PASS: AI drawer Enter/Tab/Escape/focus return');

  const patientContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const patient = await patientContext.newPage();
  patient.on('pageerror', error => errors.push(error.message));
  await login(patient, fixture.patient.email, fixture.password);
  for (const route of ['/patient/dashboard', '/patient/records', '/patient/intake', '/patient/notifications', '/patient/profile', '/patient/privacy', `/patient/case/${fixture.caseId}`]) {
    await patient.goto(BASE + route);
    await patient.locator('main').waitFor();
    await keyboardReachable(patient, route);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: route-wide keyboard audit completed with no browser errors');
} finally { await browser.close(); }
