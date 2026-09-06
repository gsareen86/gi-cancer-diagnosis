/** Prepare a scanned image on the current synthetic patient's draft for browser preview QA. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE } from './support/local-fixture.mjs';

const fixture = JSON.parse(readFileSync('var/tmp/clinical-fixture.json', 'utf8'));
assert.match(fixture.patient.email, /^e2e-patient-.*@example\.invalid$/);
const cookies = new Map();
async function request(path, body) {
  const response = await fetch(new URL(path, BASE), {
    method: body ? 'POST' : 'GET',
    headers: {
      Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]; const split = pair.indexOf('=');
    cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  const result = await response.json();
  assert.ok(response.ok, `HTTP ${response.status}: ${result.messageKey ?? result.code ?? ''}`);
  return result;
}
await request('/api/auth/login', { email: fixture.patient.email, password: fixture.password });
try {
  const cases = await request('/api/cases');
  const draft = cases.cases.find((record) => record.status === 'in_progress');
  assert.ok(draft, 'Open a draft on the synthetic fixture patient before this preview check');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4t8AAAAASUVORK5CYII=', 'base64');
  const form = new FormData();
  form.set('file', new Blob([png], { type: 'image/png' }), 'synthetic-preview.png');
  const upload = await request(`/api/cases/${draft.id}/documents`, form);
  assert.equal(upload.document.scanStatus, 'clean');
  console.log(`Scanned synthetic image ready at ${BASE}/patient/case/${draft.id}/documents`);
  console.log('Browser QA must separately confirm the image decoded (naturalWidth > 0). No case was submitted, finalized or released.');
} finally {
  await request('/api/auth/logout', {});
}
