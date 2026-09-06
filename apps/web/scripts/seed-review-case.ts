import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { tables, systemContext, type AccessContext } from '@gi-compass/db';
import { clinical, database } from '../src/server/db';
import { encryptOptional, hashPassword } from '../src/server/crypto';
import { currentPublishedTemplate } from '../src/server/services/content-service';
import { submitAnswer } from '../src/server/services/interview-service';
import { ageInYears } from '../src/server/services/age';

/**
 * Puts one case in a named doctor's review queue, for demonstrating or exercising the review side.
 *
 * The doctor-facing walkthroughs need a case to open, and the only honest way to get one is for a
 * patient to answer an interview. Doing that by hand every time is tedious, and doing it with
 * INSERT statements produces a case that never went through validation, red-flag evaluation, or
 * the state machine — so it proves nothing. This drives the same services the app's own routes
 * call, so the case it leaves behind is indistinguishable from a real one.
 *
 *   npm run demo-case -- doctor@example.com
 *
 * The patient it creates is a throwaway with an unusable password: nobody signs in as them.
 */

/** The melaena pathway: bleeding, black tarry stool, lightheaded — the emergency red flag. */
const ANSWERS = [
  ['blood_in_stool', 'yes'],
  ['blood_appearance', 'black_tarry'],
  ['lightheaded', 'yes'],
] as const;

const CONSENTS = ['account_processing', 'ai_assisted_analysis', 'share_with_assigned_doctor'] as const;

const DATE_OF_BIRTH = '1974-05-02';

const FULL_NAME = 'Demo Patient';

/**
 * The medical background a real melaena presentation would carry.
 *
 * Chosen so the doctor's record panel demonstrates the thing that panel exists for: regular
 * ibuprofen with no gastric protection, beside a prior ulcer, is the combination that changes how
 * black tarry stool reads. A demo case with an empty history would show the panel working and
 * teach nobody why it is there.
 */
const HISTORY = {
  heightCm: 158,
  weightKg: '61.50',
  conditions: [
    { code: 'peptic_ulcer', sinceYear: 2019 },
    { code: 'hypertension', sinceYear: 2016 },
    { code: 'anaemia', notes: 'Told at a camp last year; no treatment started.' },
  ],
  surgeries: [{ code: 'cholecystectomy', year: 2011 }],
  medications: [
    { name: 'Ibuprofen', kind: 'otc', frequency: 'Most days for knee pain' },
    { name: 'Amlodipine', kind: 'prescription', frequency: 'Once daily' },
  ],
  allergies: [{ substance: 'Sulfa drugs', reaction: 'Rash' }],
  familyHistory: [{ relation: 'parent', condition: 'gastric_cancer', ageAtDiagnosis: 62 }],
  lifestyle: { smoking: 'former', alcohol: 'occasional', diet: 'vegetarian' },
  additionalNotes: 'Feels tired going up stairs since about two months.',
  lastMenstrualPeriod: null,
  complete: true,
} as const;

async function main(): Promise<void> {
  const [doctorEmail] = process.argv.slice(2);
  if (doctorEmail === undefined) {
    console.error('\nUsage: npm run demo-case -- <doctor-email>\n');
    process.exit(1);
  }

  const db = database();
  const repo = clinical();

  const [doctor] = await db
    .select({ id: tables.users.id, role: tables.users.role })
    .from(tables.users)
    .where(eq(tables.users.email, doctorEmail.trim().toLowerCase()))
    .limit(1);

  if (!doctor) {
    console.error(`No account for ${doctorEmail}. Create one with: npm run user -- create doctor ${doctorEmail}`);
    process.exit(1);
  }
  if (doctor.role !== 'doctor') {
    console.error(`${doctorEmail} is a ${doctor.role}, not a doctor. A case can only be assigned to a doctor.`);
    process.exit(1);
  }

  const patientEmail = `demo-patient-${Date.now()}@example.invalid`;
  const [patient] = await db
    .insert(tables.users)
    .values({
      email: patientEmail,
      // Random and discarded: this account exists to own a case, not to be signed into.
      passwordHash: await hashPassword(randomBytes(24).toString('base64url')),
      role: 'patient',
      status: 'active',
      dateOfBirth: DATE_OF_BIRTH,
      sex: 'female',
      // Encrypted at rest like any other name. The assigned doctor sees it decrypted at the
      // point of response; the claimable queue never does.
      fullNameEnc: encryptOptional(FULL_NAME),
    })
    .returning({ id: tables.users.id });
  if (!patient) throw new Error('could not create the demo patient');

  const [policy] = await db.select().from(tables.consentPolicyVersions).limit(1);
  if (!policy) throw new Error('no consent policy is seeded — run npm run db:seed');
  await db.insert(tables.consentRecords).values(
    CONSENTS.map((purpose) => ({
      userId: patient.id,
      purpose,
      policyVersion: policy.version,
      policyId: policy.id,
    })),
  );

  const patientContext: AccessContext = {
    actor: { id: patient.id, role: 'patient' },
    subjectId: patient.id,
    purpose: 'account_processing',
  };

  const template = await currentPublishedTemplate();
  const created = await repo.createCase(patientContext, {
    patientId: patient.id,
    templateVersionId: template.versionId,
    entryPointId: 'ep_bleeding',
  });
  if (!created) throw new Error('could not open the case');

  const caseRecord = {
    id: created.id,
    status: created.status,
    templateVersionId: created.templateVersionId,
    entryPointId: created.entryPointId,
    patientId: created.patientId,
  };

  // Written through the repository like everything else, so it passes the same consent gate and
  // leaves the same audit entry a patient's own save would.
  await repo.saveClinicalHistory(patientContext, {
    caseId: created.id,
    heightCm: HISTORY.heightCm,
    weightKg: HISTORY.weightKg,
    conditions: [...HISTORY.conditions],
    surgeries: [...HISTORY.surgeries],
    medications: [...HISTORY.medications],
    allergies: [...HISTORY.allergies],
    familyHistory: [...HISTORY.familyHistory],
    lifestyle: HISTORY.lifestyle,
    additionalNotes: HISTORY.additionalNotes,
    lastMenstrualPeriod: HISTORY.lastMenstrualPeriod,
    complete: HISTORY.complete,
  });

  let flags = 0;
  for (const [questionId, optionId] of ANSWERS) {
    const result = await submitAnswer({
      context: patientContext,
      caseRecord,
      questionId,
      rawValue: { kind: 'single_select', optionId },
      locale: 'en',
      ageYears: ageInYears(DATE_OF_BIRTH),
    });
    // A rejection here means the seeded question bank has moved on from this path, and the case
    // would be half-answered. Better to say so than to leave a misleading one in the queue.
    if (result.status === 'rejected') {
      throw new Error(`the interview rejected ${questionId}: ${result.rejection.ok ? '' : result.rejection.rejection.message}`);
    }
    flags += result.newlyTriggered.length;
  }

  const share = systemContext(patient.id, 'share_with_assigned_doctor');
  await repo.transitionCase(share, created.id, 'submitted', { submittedAt: new Date() });
  await repo.assignDoctor(share, created.id, doctor.id, doctor.id);
  await repo.transitionCase(share, created.id, 'in_review');

  console.log('');
  console.log(`  Case ${created.id}`);
  console.log(`  Patient: ${patientEmail} (throwaway)`);
  console.log(`  Waiting for: ${doctorEmail}`);
  console.log(`  Red flags raised: ${flags}`);
  console.log('  Clinical history: recorded (NSAID use, prior ulcer, family gastric cancer)');
  console.log('');
  console.log(`  http://localhost:3000/doctor/case/${created.id}`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
