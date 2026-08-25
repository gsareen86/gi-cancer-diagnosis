import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { visibleText } from './support/page-text.mjs';

/**
 * Verifies the Hindi path, once the clinical text has been clinician-approved.
 *
 * Separate from the main walkthrough because approving a language means editing published
 * content, and a published version is immutable — the app caches it per version id and never
 * expects one to change underneath. Restarting is the honest way to pick the change up.
 *
 * Note that approval is a two-part act: the question bank and the red-flag rule set are versioned
 * separately, so both need the locale approved before a patient sees a fully Hindi screen.
 */

const BASE = 'http://localhost:3000';
const sql = (q) =>
  execSync(`psql -h 127.0.0.1 -p 55432 -U postgres -d gi_compass -tAc "${q.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
  }).trim();

sql(`UPDATE template_versions SET approved_locales = ARRAY['en','hi'], content = jsonb_set(content, '{approvedLocales}', '["en","hi"]') WHERE status='published'`);
sql(`UPDATE red_flag_rule_sets SET content = jsonb_set(content, '{approvedLocales}', '["en","hi"]') WHERE status='published'`);
console.log('approved Hindi on both the question bank and the red-flag rule set');
console.log('restart the server, then run: node verify-hindi.mjs --check');

if (!process.argv.includes('--check')) process.exit(0);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
const switcher = await page.$('#locale-switcher');
console.log(`switcher now offered: ${switcher !== null}`);

if (switcher !== null) {
  await page.selectOption('#locale-switcher', 'hi');
  await page.waitForTimeout(1500);
  const text = await visibleText(page);
  console.log(`interface renders Devanagari: ${/[ऀ-ॿ]/.test(text)}`);
  await page.screenshot({ path: '/var/tmp/gi-final/hindi-home.png', fullPage: true });
}
await browser.close();
