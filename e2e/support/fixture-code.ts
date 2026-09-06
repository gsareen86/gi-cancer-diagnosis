import { readFile } from 'node:fs/promises';
import { codeForStep, currentStep } from '../../apps/web/src/server/auth/totp';
const fixture = JSON.parse(await readFile('var/tmp/clinical-fixture.json', 'utf8')) as { totpSecret: string };
console.log(codeForStep(fixture.totpSecret, currentStep()));
