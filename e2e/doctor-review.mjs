import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

/**
 * The doctor's half of the loop: queue → case → override → finalize → release,
 * and then the patient reading exactly what was released.
 */

const BASE = 'http://localhost:3000';
const SHOTS = process.env.SHOTS ?? '/var/tmp/gi-doctor';
execSync(`mkdir -p ${SHOTS}`);

/**
 * Runs SQL through a temp file rather than the shell.
 *
 * The fixtures include JSON payloads, and quoting those through a shell command line mangles
 * every backslash. A file has no quoting problem to get wrong.
 */
function sql(query) {
  const path = `/tmp/gi-drive-${randomUUID()}.sql`;
  writeFileSync(path, query);
  try {
    return execSync(`psql -h 127.0.0.1 -p 55432 -U postgres -d gi_compass -tA -v ON_ERROR_STOP=1 -f ${path}`, {
      encoding: 'utf8',
    }).trim();
  } finally {
    unlinkSync(path);
  }
}

const password = 'a-perfectly-fine-passphrase';
const hashOf = (value) =>
  execSync(
    `node -e "const c=require('crypto');process.stdout.write(c.createHash('sha256').update('${value}').digest('hex'))"`,
    { encoding: 'utf8' },
  );

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function signedInPage(email, role) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', (e) => console.log(`  PAGEERROR(${role}):`, e.message.slice(0, 200)));
  await page.goto(`${BASE}/login`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  return page;
}

// A patient with a submitted, AI-processed case, set up through the API the same way the app does.
const patientEmail = `doctor-flow-patient-${Date.now()}@example.invalid`;
const doctorEmail = `doctor-flow-doctor-${Date.now()}@example.invalid`;

console.log('1. create a doctor and a patient');
const argonHash = execSync(
  `cd apps/web && node -e "const {hash}=require('@node-rs/argon2');hash('${password}',{memoryCost:19456,timeCost:2,parallelism:1}).then(h=>process.stdout.write(h))"`,
  { encoding: 'utf8', shell: '/bin/bash' },
);
sql(`INSERT INTO users (email, password_hash, role, status, date_of_birth, sex) VALUES ('${doctorEmail}','${argonHash}','doctor','active','1970-01-01','female')`);
sql(`INSERT INTO users (email, password_hash, role, status, date_of_birth, sex) VALUES ('${patientEmail}','${argonHash}','patient','active','1974-05-02','female')`);
const doctorId = sql(`SELECT id FROM users WHERE email='${doctorEmail}'`);
const patientId = sql(`SELECT id FROM users WHERE email='${patientEmail}'`);

console.log('2. consent, case, answers, red flag, and an AI assessment');
const policyId = sql(`SELECT id FROM consent_policy_versions LIMIT 1`);
const policyVersion = sql(`SELECT version FROM consent_policy_versions LIMIT 1`);
for (const purpose of ['account_processing', 'ai_assisted_analysis', 'share_with_assigned_doctor']) {
  sql(`INSERT INTO consent_records (user_id, purpose, policy_version, policy_id) VALUES ('${patientId}','${purpose}','${policyVersion}','${policyId}')`);
}
const templateVersionId = sql(`SELECT id FROM template_versions WHERE status='published' LIMIT 1`);
sql(`INSERT INTO cases (patient_id, template_version_id, entry_point_id, status, submitted_at, assigned_doctor_id) VALUES ('${patientId}','${templateVersionId}','ep_bleeding','in_review', now(), '${doctorId}')`);
const caseId = sql(`SELECT id FROM cases WHERE patient_id='${patientId}'`);
sql(`INSERT INTO case_assignments (case_id, doctor_id, assigned_by) VALUES ('${caseId}','${doctorId}','${doctorId}')`);

for (const [q, o] of [['blood_in_stool','yes'],['blood_appearance','black_tarry'],['lightheaded','yes']]) {
  sql(`INSERT INTO responses (case_id, question_id, value) VALUES ('${caseId}','${q}','${JSON.stringify({ kind: 'single_select', optionId: o })}')`);
}
const ruleSetId = sql(`SELECT id FROM red_flag_rule_sets WHERE status='published' LIMIT 1`);
sql(`INSERT INTO red_flag_triggers (case_id, rule_set_id, rule_id, urgency, basis_key, contributing_question_ids) VALUES ('${caseId}','${ruleSetId}','rf_upper_gi_bleed_with_hypovolaemia','emergency','redflag.upper_gi_bleed_with_hypovolaemia', ARRAY['blood_appearance','lightheaded'])`);

const disclaimer = 'This is an AI-generated decision-support summary based on patient-reported information and is not a medical diagnosis. It has not yet been reviewed by a physician. All clinical decisions must be made by the treating doctor after direct evaluation.';
const aiSummary = 'Adult reporting melaena with lightheadedness. Pattern warrants urgent upper GI evaluation.';
const payload = JSON.stringify({
  case_id: caseId, model_version: 'test-model-1', prompt_version: 'assessment-v1', kb_version: 'kb-seed-1',
  generated_at: new Date().toISOString(),
  differential_assessment: [{
    condition: 'Peptic ulcer disease', likelihood: 'moderate',
    supporting_findings: ['Reported black tarry stool with lightheadedness'],
    contradicting_or_atypical_findings: ['No reported weight loss'],
    suggested_confirmatory_steps: ['Upper GI endoscopy'],
  }],
  red_flags: [], recommended_next_steps: ['Urgent in-person assessment'],
  clinician_summary: aiSummary, disclaimer,
}).replace(/'/g, "''");
sql(`INSERT INTO ai_assessments (case_id, outcome, model_version, prompt_version, kb_version, retrieved_chunk_ids, payload) VALUES ('${caseId}','generated','test-model-1','assessment-v1','kb-seed-1', ARRAY['chunk-a'], '${payload}')`);

console.log('3. doctor signs in and opens the queue');
const doctor = await signedInPage(doctorEmail, 'doctor');
// A doctor account carries an MFA-pending session, which reaches enrolment and nothing else.
console.log(`   landed on: ${doctor.url().replace(BASE, '')}`);
await doctor.screenshot({ path: `${SHOTS}/01-doctor-mfa-gate.png`, fullPage: true });

// Satisfy the second factor the way enrolment would, so the rest of the flow is reachable.
sql(`UPDATE sessions SET mfa_pending = false WHERE user_id='${doctorId}'`);
await doctor.goto(`${BASE}/doctor/queue`);
await doctor.waitForTimeout(1500);
await doctor.screenshot({ path: `${SHOTS}/02-queue.png`, fullPage: true });
const queueText = (await doctor.textContent('body')) ?? '';
console.log(`   queue shows an emergency case: ${queueText.includes('Emergency')}`);

console.log('4. open the case');
await doctor.goto(`${BASE}/doctor/cases/${caseId}`);
await doctor.waitForTimeout(2000);
await doctor.screenshot({ path: `${SHOTS}/03-case-review.png`, fullPage: true });
const caseText = (await doctor.textContent('body')) ?? '';
console.log(`   answers shown: ${caseText.includes('blood look like') || caseText.includes('Black')}`);
console.log(`   AI assessment shown: ${caseText.includes('Peptic ulcer disease')}`);
console.log(`   version pins shown: ${caseText.includes('test-model-1')}`);
console.log(`   disclaimer shown: ${caseText.includes('not a medical diagnosis')}`);

console.log('5. try to finalize with the AI summary passed through');
await doctor.fill('#impression', aiSummary);
await doctor.fill('#patient-summary', 'You need an urgent camera test of your stomach, please attend.');
await doctor.click('button:has-text("Finalize")');
await doctor.waitForTimeout(1500);
const passthroughRefused = ((await doctor.textContent('body')) ?? '').includes('your own words');
console.log(`   pass-through refused: ${passthroughRefused}`);
await doctor.screenshot({ path: `${SHOTS}/04-passthrough-refused.png`, fullPage: true });

console.log('6. try to finalize with a medication in the next steps');
await doctor.fill('#impression', 'My impression is upper GI bleeding needing urgent endoscopic assessment, pending in-person review.');
await doctor.fill('#next-steps', 'Start omeprazole 40 mg daily');
await doctor.click('button:has-text("Finalize")');
await doctor.waitForTimeout(1500);
const treatmentRefused = ((await doctor.textContent('body')) ?? '').includes('Remove the medication');
console.log(`   prescribing refused: ${treatmentRefused}`);
await doctor.screenshot({ path: `${SHOTS}/05-prescribing-refused.png`, fullPage: true });

console.log('7. finalize properly, then release with confirmation');
await doctor.fill('#next-steps', 'Upper GI endoscopy within one week\nFull blood count and iron studies');
await doctor.click('button:has-text("Finalize")');
await doctor.waitForTimeout(1500);
await doctor.click('button:has-text("Release to patient")');
await doctor.waitForSelector('[role=dialog]', { timeout: 10000 });
await doctor.screenshot({ path: `${SHOTS}/06-release-confirm.png`, fullPage: true });

const beforeRelease = sql(`SELECT status FROM cases WHERE id='${caseId}'`);
console.log(`   case status while the dialog is open: ${beforeRelease}`);

await doctor.click('button:has-text("Yes, release it")');
await doctor.waitForTimeout(2000);
await doctor.screenshot({ path: `${SHOTS}/07-released.png`, fullPage: true });
console.log(`   case status after confirming: ${sql(`SELECT status FROM cases WHERE id='${caseId}'`)}`);

console.log('8. patient reads what was released');
const patient = await signedInPage(patientEmail, 'patient');
await patient.goto(`${BASE}/cases/${caseId}`);
await patient.waitForTimeout(1500);
await patient.screenshot({ path: `${SHOTS}/08-patient-result.png`, fullPage: true });
const patientText = (await patient.textContent('body')) ?? '';
console.log(`   released summary visible: ${patientText.includes('camera test')}`);
console.log(`   AI summary leaked: ${patientText.includes(aiSummary)}`);
console.log(`   model version leaked: ${patientText.includes('test-model-1')}`);
console.log(`   standing notice shown: ${patientText.includes('not a final diagnosis')}`);

await browser.close();
