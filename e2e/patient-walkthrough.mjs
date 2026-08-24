import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:3000';
const SHOTS = process.env.SHOTS ?? '/var/tmp/gi-shots';
execSync(`mkdir -p ${SHOTS}`);

const email = `walkthrough-${Date.now()}@example.invalid`;
const password = 'a-perfectly-fine-passphrase';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const log = [];
page.on('console', (m) => m.type() === 'error' && log.push(`console: ${m.text()}`));
page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`));

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`  → ${name}.png`);
}

function sql(query) {
  return execSync(
    `psql -h 127.0.0.1 -p 55432 -U postgres -d gi_compass -tAc "${query.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' },
  ).trim();
}

console.log('1. home');
await page.goto(BASE);
await shot('01-home');

console.log('2. register');
await page.goto(`${BASE}/register`);
await page.fill('#email', email);
await page.fill('#password', password);
await page.click('button[type=submit]');
await page.waitForSelector('text=/Check your email/i', { timeout: 10000 });
await shot('02-registered');

console.log('3. verify email (token straight from the database, as the email link would)');
const userId = sql(`SELECT id FROM users WHERE email='${email}'`);
// The plaintext token only exists in the email; replace the stored hash with a known one.
const knownToken = `walkthrough-token-${Date.now()}`;
const hash = execSync(
  `node -e "const c=require('crypto');process.stdout.write(c.createHash('sha256').update('${knownToken}').digest('hex'))"`,
  { encoding: 'utf8' },
);
sql(`UPDATE one_time_tokens SET token_hash='${hash}' WHERE user_id='${userId}' AND purpose='email_verification'`);
await page.goto(`${BASE}/verify-email?token=${knownToken}`);
await page.waitForSelector('text=/confirmed/i', { timeout: 10000 });
await shot('03-verified');

console.log('4. sign in');
await page.goto(`${BASE}/login`);
await page.fill('#email', email);
await page.fill('#password', password);
await page.click('button[type=submit]');
await page.waitForURL('**/profile', { timeout: 10000 }).catch(() => {});
await page.goto(`${BASE}/profile`);
await shot('04-profile');

console.log('5. complete profile');
await page.fill('#fullName', 'Walkthrough Patient');
await page.fill('input[id$="-day"]', '2');
await page.selectOption('select[id$="-month"]', '5');
await page.fill('input[id$="-year"]', '1974');
await page.selectOption('#sex', 'female');
await page.click('button[type=submit]');
await page.waitForURL('**/consent', { timeout: 10000 });
await shot('05-consent');

console.log('6. grant all three consents separately');
const boxes = await page.$$('input[type=checkbox]');
for (const box of boxes) await box.check();
await shot('06-consent-selected');
await page.click('button:has-text("Save and continue")');
await page.waitForURL('**/start', { timeout: 10000 });
await shot('07-symptom-areas');

console.log('7. start the bleeding pathway');
await page.click('button:has-text("Blood when I go to the toilet")');
await page.waitForURL('**/interview', { timeout: 10000 });
await shot('08-first-question');

/** Answers whatever question is on screen, driving toward the melaena emergency pathway. */
const SCRIPTED = {
  blood_in_stool: 'yes',
  blood_appearance: 'black_tarry',
  lightheaded: 'yes',
  vomited_blood: 'no',
  painkiller_use: 'never',
  blood_thinner_use: 'no',
  blood_duration: null,
  weight_loss: 'no',
  known_conditions: 'none',
};

async function currentQuestionId() {
  const card = await page.$('[data-question-id]');
  return card === null ? null : card.getAttribute('data-question-id');
}

async function answerCurrent() {
  const id = await currentQuestionId();
  if (id === null) return null;

  const optionId = SCRIPTED[id];
  if (optionId === undefined) {
    // Anything unscripted: take the first available choice so the walk keeps moving.
    const radio = await page.$('input[type=radio]');
    if (radio !== null) await radio.check();
    else {
      const box = await page.$('input[type=checkbox]');
      if (box !== null) await box.check();
      else {
        const number = await page.$('input[type=number]');
        if (number !== null) await number.fill('3');
      }
    }
  } else if (optionId === null) {
    await page.fill('input[type=number]', '21');
  } else {
    const radios = await page.$$('input[type=radio]');
    const labels = await page.$$eval('label:has(input[type=radio])', (nodes) =>
      nodes.map((node) => node.textContent?.trim() ?? ''),
    );
    void labels;
    // Options render in their declared order, so index by position in the scripted answer.
    const index = await page.$$eval(
      '[data-question-id] label:has(input[type=radio])',
      (nodes) => nodes.length,
    );
    void index;
    const target = radios[optionIndexFor(id, optionId)] ?? radios[0];
    if (target !== undefined) await target.check();
  }

  await page.click('button:has-text("Next"), button:has-text("आगे")');
  await page.waitForTimeout(800);
  return id;
}

const OPTION_ORDER = {
  blood_in_stool: ['yes', 'no', 'unsure'],
  blood_appearance: ['bright_red', 'dark_red', 'black_tarry'],
  lightheaded: ['yes', 'no', 'unsure'],
  vomited_blood: ['yes', 'no', 'unsure'],
  painkiller_use: ['never', 'occasionally', 'most_weeks', 'daily'],
  blood_thinner_use: ['yes', 'no', 'unsure'],
  weight_loss: ['yes', 'no', 'unsure'],
};

function optionIndexFor(questionId, optionId) {
  return Math.max(0, (OPTION_ORDER[questionId] ?? []).indexOf(optionId));
}

console.log('8. walk the melaena pathway until the emergency fires');
let emergencyShown = false;
for (let step = 0; step < 12; step += 1) {
  const id = await answerCurrent();
  console.log(`   answered: ${id}`);
  if (await page.$('[role=alertdialog]')) {
    emergencyShown = true;
    break;
  }
  if (id === null) break;
}

if (!emergencyShown) {
  console.log('   NO EMERGENCY SHOWN');
  await shot('11-no-emergency');
  await browser.close();
  process.exit(1);
}
await shot('11-EMERGENCY');

const emergencyText = await page.textContent('[role=alertdialog]');
const namesCondition = ['cancer', 'ulcer', 'perforation', 'malignancy', 'crohn'].filter((term) =>
  emergencyText.toLowerCase().includes(term),
);
console.log(`   112 and 108 shown: ${emergencyText.includes('112') && emergencyText.includes('108')}`);
console.log(`   names a condition: ${namesCondition.length > 0 ? namesCondition : 'no'}`);

console.log('11. acknowledge and continue');
await page.click('button:has-text("let me carry on")');
await page.waitForTimeout(800);
await shot('12-persistent-banner');

console.log('12. language switcher offers only what the clinical content can serve');
// Hindi clinical text exists but is not clinician-approved, so Hindi is not offered at all —
// an interface translated around English symptom questions would imply a translation that is
// not there. Approving it is a separate step (see verify-hindi.mjs), because a published
// version is immutable and the app caches it per version id.
const switcherShown = (await page.$('#locale-switcher')) !== null;
console.log(`   switcher offered while only English is approved: ${switcherShown}`);
if (switcherShown) {
  console.log('   UNEXPECTED: Hindi offered without clinician approval');
  process.exitCode = 1;
}

const answersKept = sql(`SELECT count(*) FROM responses WHERE case_id=(SELECT id FROM cases WHERE patient_id='${userId}')`);
console.log(`   answers still stored after language switch: ${answersKept}`);

const flags = sql(`SELECT rule_id||' ['||urgency||']' FROM red_flag_triggers WHERE case_id=(SELECT id FROM cases WHERE patient_id='${userId}')`);
console.log(`   red flags recorded: ${flags.split('\n').join(', ')}`);

const auditHasAnswerValue = sql(`SELECT count(*) FROM audit_log_entries WHERE metadata::text ILIKE '%black_tarry%'`);
console.log(`   audit rows containing an answer value: ${auditHasAnswerValue}`);

console.log('\nbrowser errors:', log.length === 0 ? 'none' : log);
await browser.close();
