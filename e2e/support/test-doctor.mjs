import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

/**
 * Provisions a throwaway doctor for an end-to-end run.
 *
 * These walkthroughs need an account with no second factor enrolled, because they read the
 * enrolment secret off the screen to generate a code. Borrowing a real account means clearing its
 * factor first — which silently invalidates whatever is in that person's authenticator app, with
 * no way back except enrolling again. That happened, so the scripts now bring their own account
 * and never touch anyone else's.
 *
 * Created through the same CLI a human would use, so this exercises the real path rather than a
 * shortcut into the database.
 */
export function provisionDoctor() {
  const email = `e2e-doctor-${Date.now()}@example.invalid`;
  // Long and random: it lives only for this run, but it still has to satisfy the password policy.
  const password = `${randomBytes(18).toString('base64url')}-e2e`;

  // A shell, because `npm` is a batch file on Windows and Node refuses to spawn one without it.
  // Interpolating into that string is only safe because both values are generated right here from
  // base64url and digits — neither can carry a shell metacharacter.
  execSync(`npm run user -- create doctor ${email} ${password}`, {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  return { email, password };
}

/**
 * Resolves the account a walkthrough should use.
 *
 * Supplying DOCTOR_EMAIL and DOCTOR_PASSWORD is still possible, but that account must already
 * have no second factor — the script will not clear one, because it cannot know whether it
 * belongs to a real person.
 */
export function resolveDoctor() {
  const email = process.env.DOCTOR_EMAIL;
  const password = process.env.DOCTOR_PASSWORD;

  if (email !== undefined && password !== undefined) {
    console.log(`  using the supplied account ${email}`);
    console.log('  (it must have no second factor enrolled; this script will not clear one)');
    return { email, password, provisioned: false };
  }

  const created = provisionDoctor();
  console.log(`  provisioned a throwaway doctor: ${created.email}`);
  return { ...created, provisioned: true };
}

/**
 * Puts a case in the queue of the doctor the walkthrough is about to sign in as.
 *
 * A throwaway doctor starts with an empty queue, so a walkthrough that needs a case to open has to
 * bring one. This goes through the same script an operator would run, which drives the app's own
 * interview and state machine rather than inserting rows.
 */
export function provisionCase(doctorEmail) {
  const output = execSync(`npm run demo-case -- ${doctorEmail}`, {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  const caseId = /Case ([0-9a-f-]{36})/.exec(output)?.[1];
  if (caseId === undefined) throw new Error(`could not read a case id from:\n${output}`);
  console.log(`  seeded a case for review: ${caseId}`);
  return caseId;
}
