/** Live HTTP contract checks, not a substitute for browser interaction/visual QA. */
import assert from 'node:assert/strict';
import { BASE, createFixture, fixtureCode } from './support/local-fixture.mjs';

const fixture = createFixture();
let checks = 0;
function client() {
  const cookies = new Map();
  return async (path, { method = 'GET', body, status = 200, binary = false } = {}) => {
    const response = await fetch(new URL(path, BASE), {
      method, redirect: 'manual',
      headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), Origin: BASE,
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const split = pair.indexOf('=');
      cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    const payload = binary ? Buffer.from(await response.arrayBuffer()) : await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(binary ? response.status : payload)}`);
    checks++;
    return { payload, headers: response.headers };
  };
}
const doctor = client();
const patient = client();
const anonymous = client();
const casePath = `/api/doctor/cases/${fixture.caseId}`;
const summaryPath = `/api/cases/${fixture.caseId}/summary`;
await anonymous(summaryPath, { status: 401 });
const login = await doctor('/api/auth/login', { method: 'POST', body: { email: fixture.doctor.email, password: fixture.password } });
assert.equal(login.payload.mfaPending, true);
await doctor('/api/doctor/metrics', { status: 403 });
await doctor('/api/auth/mfa/verify', { method: 'POST', body: { code: fixtureCode() } });
await patient('/api/auth/login', { method: 'POST', body: { email: fixture.patient.email, password: fixture.password } });
await patient('/api/doctor/metrics', { status: 403 });
assert.equal((await patient(summaryPath)).payload.released, false);
await patient(`${summaryPath}/pdf`, { status: 404 });
await doctor('/api/notifications/sync', { method: 'POST' });
await doctor('/api/notifications/sync', { method: 'POST' });
const alerts = (await doctor('/api/notifications')).payload.entries;
assert.equal(alerts.filter((entry) => entry.type === 'doctor_overdue_case' && entry.reference === fixture.caseId).length, 1);
await doctor(`${casePath}/review/start`, { method: 'POST' });
const references = (await doctor(casePath)).payload;
assert.match(references.case.reference, /^GC\d{6,}$/);
assert.match(references.patient.reference, /^GI\d{6,}$/);
assert.equal((await doctor(casePath)).payload.case.reference, references.case.reference);
const content = {
  differential: [], recommendedNextSteps: ['Synthetic QA instruction: review prior records.'],
  clinicalImpression: 'Synthetic clinical impression approved for a software test only.',
  patientFacingSummary: 'Synthetic patient summary approved for a software test only.',
  prescriptionInstructions: 'Synthetic prescription field authored by a physician; not for treatment.',
  doctorNotes: 'PRIVATE-QA-NOTE-MUST-NOT-LEAK', diagnosis: 'Synthetic QA diagnosis',
  dietaryAdvice: '', precautions: '', referralUrgency: 'routine', followUpInterval: '', finalize: true,
};
await doctor(`${casePath}/review`, { method: 'PUT', body: { ...content, clinicalImpression: 'short' }, status: 400 });
await doctor(`${casePath}/review`, { method: 'PUT', body: content });
const confirmedContent = {
  summary: content.patientFacingSummary, nextSteps: content.recommendedNextSteps,
  diagnosis: content.diagnosis, dietaryAdvice: '', precautions: '', referralUrgency: 'routine',
  followUpInterval: '', prescriptionInstructions: content.prescriptionInstructions,
};
await doctor(`${casePath}/release`, { method: 'POST', body: { confirm: true, confirmedContent: { ...confirmedContent, summary: 'Stale synthetic summary, not the approved content.' } }, status: 409 });
const { prescriptionInstructions, ...omittedPrescription } = confirmedContent;
await doctor(`${casePath}/release`, { method: 'POST', body: { confirm: true, confirmedContent: omittedPrescription }, status: 409 });
await doctor(`${casePath}/release`, { method: 'POST', body: { confirm: true, confirmedContent } });
await doctor(`${casePath}/release`, { method: 'POST', body: { confirm: true, confirmedContent }, status: 409 });
await doctor(`${casePath}/review`, { method: 'PUT', body: content, status: 409 });
const released = (await patient(summaryPath)).payload;
assert.equal(released.content.summary, content.patientFacingSummary);
assert.equal(released.content.prescriptionInstructions, prescriptionInstructions);
assert.ok(!JSON.stringify(released).includes(content.doctorNotes));
assert.ok(!JSON.stringify(released).includes('synthetic-qa'));
const pdf = await patient(`${summaryPath}/pdf`, { binary: true });
assert.equal(pdf.payload.subarray(0, 5).toString(), '%PDF-');
assert.match(pdf.headers.get('cache-control'), /no-store/);
await doctor(`${summaryPath}/pdf`, { status: 403 });
await patient(`${summaryPath}/acknowledge`, { method: 'POST' });
assert.deepEqual((await patient(summaryPath)).payload.content, released.content);
assert.equal((await patient(summaryPath)).payload.status, 'closed');

// Storage/scanning and signed content are checked through actual HTTP endpoints.
const draft = (await patient('/api/cases', { method: 'POST', body: { entryPointId: 'ep_bowel' }, status: 201 })).payload.case;
const previousHistoryPath = `/api/cases/${fixture.caseId}/history`;
const previousHistory = (await patient(previousHistoryPath)).payload.history;
const historyPath = `/api/cases/${draft.id}/history`;
assert.equal((await patient(historyPath)).payload.prefill.heightCm, previousHistory.heightCm);
await patient(historyPath, { method: 'PUT', body: { heightCm: 175, weightKg: 70, complete: true } });
assert.equal((await patient(historyPath)).payload.history.heightCm, 175);
assert.deepEqual((await patient(previousHistoryPath)).payload.history, previousHistory);
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4t8AAAAASUVORK5CYII=', 'base64');
const form = new FormData();
form.set('file', new Blob([tinyPng], { type: 'image/png' }), 'synthetic-qa.png');
const upload = (await patient(`/api/cases/${draft.id}/documents`, { method: 'POST', body: form, status: 201 })).payload;
assert.equal(upload.document.scanStatus, 'clean', 'Live scanner must approve before content is available');
const documentPath = `/api/cases/${draft.id}/documents/${upload.document.id}`;
const metadata = (await patient(documentPath)).payload;
const served = await patient(metadata.url, { binary: true });
assert.deepEqual(served.payload, tinyPng);
assert.match(served.headers.get('cache-control'), /no-store/);
await anonymous(metadata.url, { status: 401 });
await doctor(metadata.url, { status: 404 });
await patient(documentPath, { method: 'DELETE' });
const logout = await patient('/api/auth/logout', { method: 'POST' });
assert.ok(logout.headers.getSetCookie().some((cookie) => cookie.includes('Path=/api/auth/refresh') && /Max-Age=0/.test(cookie)));
await patient(summaryPath, { status: 401 });
await doctor('/api/auth/logout', { method: 'POST' });
console.log(`Passed ${checks} live HTTP checks: MFA, role gates, review/release, frozen PDF, acknowledgement, notifications, scanned storage, signed content and logout.`);
console.log(`Synthetic case retained for inspection: ${fixture.caseId}`);
