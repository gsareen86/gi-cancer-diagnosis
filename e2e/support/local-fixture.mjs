import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(BASE).hostname)) {
  throw new Error('Synthetic walkthroughs may only target a local application');
}
function run(script) {
  return execFileSync(process.execPath, [
    '--env-file-if-exists=.env', 'node_modules/vite-node/vite-node.mjs',
    '--config', 'apps/web/vitest.unit.config.ts', '--script', script,
  ], { cwd: resolve('.'), encoding: 'utf8', timeout: 60_000 });
}
export function createFixture() {
  run('e2e/support/clinical-fixture.ts');
  return JSON.parse(readFileSync('var/tmp/clinical-fixture.json', 'utf8'));
}
export function fixtureCode() { return run('e2e/support/fixture-code.ts').trim(); }
