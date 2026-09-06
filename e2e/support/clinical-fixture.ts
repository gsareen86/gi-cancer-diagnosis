import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tables, systemContext } from '@gi-compass/db';
import { MANDATORY_DISCLAIMER } from '@gi-compass/core';
import { clinical, database } from '../../apps/web/src/server/db';
import { encryptField, encryptOptional, hashPassword } from '../../apps/web/src/server/crypto';
import { generateSecret } from '../../apps/web/src/server/auth/totp';
import { seed } from '../../packages/db/src/seed/index';
import { currentPublishedTemplate } from '../../apps/web/src/server/services/content-service';

/** Synthetic, local-only fixture. Never resets a real user's MFA or changes an existing case. */
const target = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw new Error('E2E fixtures require a local database');
const db = database();
if ((await db.select().from(tables.questionnaireTemplates).limit(1)).length === 0) await seed(db);
const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`;
const password = `${randomBytes(18).toString('base64url')}-Demo9!`;
const passwordHash = await hashPassword(password);
const [doctor] = await db.insert(tables.users).values({ email: `e2e-clinician-${suffix}@example.invalid`, passwordHash, role: 'doctor', status: 'active', fullNameEnc: encryptOptional('Dr. Avery Morgan (Demo)') }).returning();
const [patient] = await db.insert(tables.users).values({ email: `e2e-patient-${suffix}@example.invalid`, passwordHash, role: 'patient', status: 'active', fullNameEnc: encryptOptional('Alex Taylor (Demo)'), dateOfBirth: '1974-05-02', sex: 'female' }).returning();
if (!doctor || !patient) throw new Error('Could not create fixture users');
const totpSecret = generateSecret();
await db.insert(tables.totpFactors).values({ userId: doctor.id, secretEnc: encryptField(totpSecret), confirmedAt: new Date() });
const [policy] = await db.select().from(tables.consentPolicyVersions).limit(1);
if (!policy) throw new Error('Seed consent policy first');
await db.insert(tables.consentRecords).values((['account_processing', 'share_with_assigned_doctor', 'ai_assisted_analysis'] as const).map((purpose) => ({ userId: patient.id, purpose, policyId: policy.id, policyVersion: policy.version })));
const repo = clinical();
const context = { actor: { id: patient.id, role: 'patient' as const }, subjectId: patient.id, purpose: 'account_processing' as const };
const template = await currentPublishedTemplate();
const record = await repo.createCase(context, { patientId: patient.id, templateVersionId: template.versionId, entryPointId: 'ep_bleeding' });
if (!record) throw new Error('Could not create fixture case');
await repo.saveClinicalHistory(context, { caseId: record.id, heightCm: 168, weightKg: '66.00', conditions: [{ code: 'peptic_ulcer', sinceYear: 2019 }], surgeries: [{ code: 'cholecystectomy', year: 2014 }], medications: [{ name: 'Ibuprofen (patient reported)', kind: 'otc', frequency: 'Occasional' }], allergies: [{ substance: 'Sulfonamides', reaction: 'Rash' }], familyHistory: [{ relation: 'parent', condition: 'colorectal_polyps', ageAtDiagnosis: 61 }], lifestyle: { smoking: 'never', alcohol: 'occasional' }, additionalNotes: 'Synthetic QA data. Not a real patient.', lastMenstrualPeriod: null, complete: true });
const share = systemContext(patient.id, 'share_with_assigned_doctor');
await repo.transitionCase(share, record.id, 'submitted', { submittedAt: new Date(Date.now() - 52 * 3_600_000) });
await repo.assignDoctor(share, record.id, doctor.id, doctor.id);
const ai = systemContext(patient.id, 'ai_assisted_analysis');
await repo.transitionCase(ai, record.id, 'ai_processing');
await repo.recordAssessment(ai, { caseId: record.id, outcome: 'generated', modelVersion: 'synthetic-qa', promptVersion: 'assessment-v1', kbVersion: 'qa', retrievedChunkIds: [], payload: {
  case_id: record.id, generated_at: new Date().toISOString(), model_version: 'synthetic-qa', prompt_version: 'assessment-v1', kb_version: 'qa',
  clinician_summary: 'Synthetic review example: patient-reported upper gastrointestinal symptoms require direct clinical evaluation. This is test content, not a medical recommendation.',
  differential_assessment: [{ condition: 'Peptic ulcer disease', likelihood: 'moderate', supporting_findings: ['Patient-reported ulcer history'], contradicting_or_atypical_findings: ['No examination is available'], suggested_confirmatory_steps: ['Review prior records and assess in person'] }],
  recommended_next_steps: ['Review prior records and assess in person'], red_flags: [], disclaimer: MANDATORY_DISCLAIMER,
} });
await repo.transitionCase(ai, record.id, 'ai_processed');
await mkdir('var/tmp', { recursive: true });
await writeFile(join('var/tmp', 'clinical-fixture.json'), JSON.stringify({ doctor: { id: doctor.id, email: doctor.email }, patient: { id: patient.id, email: patient.email }, password, totpSecret, caseId: record.id }, null, 2));
console.log(`Created local synthetic case ${record.id}; credentials are in ignored var/tmp/clinical-fixture.json.`);
process.exit(0);
