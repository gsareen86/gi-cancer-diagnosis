/** Opt-in real LOCAL model smoke check. No real patient records or cloud model requests. */
import assert from 'node:assert/strict';
import { BASE, createFixture, fixtureCode } from './support/local-fixture.mjs';
const health = await (await fetch('http://127.0.0.1:8000/health')).json();
assert.equal(health.provider, 'llamacpp');
assert.equal(health.reachable, true);
assert.ok(health.servedModel && !/stub|not-a-real-model/.test(health.servedModel));
const fixture = createFixture();
const cookies = new Map();
async function request(path, body) {
  const response = await fetch(new URL(path, BASE), {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(1_850_000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]; const split = pair.indexOf('=');
    cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  const value = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${value.messageKey ?? value.code}`);
  return value;
}
await request('/api/auth/login', { email: fixture.doctor.email, password: fixture.password });
await request('/api/auth/mfa/verify', { code: fixtureCode() });
console.log(`Requesting a real local assessment from ${health.servedModel}; synthetic case ${fixture.caseId}.`);
const result = await request(`/api/doctor/cases/${fixture.caseId}/assessment`, {});
assert.equal(result.status, 'generated');
const caseView = await request(`/api/doctor/cases/${fixture.caseId}`);
assert.ok(caseView.assessment?.payload);
assert.equal(caseView.assessment.modelVersion, health.servedModel);
await request('/api/auth/logout', {});
console.log(`PASS: validated and stored real local-model output; grounded=${result.grounded}. No summary finalized or released.`);
