import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards against source files that exist locally but were never committed.
 *
 * This is not hypothetical. The repository started from a Python `.gitignore`, whose unanchored
 * `lib/` pattern matches at *any* depth — so `apps/web/src/lib/` was silently excluded. Four
 * modules the whole interface imports were missing from every clone, the local tree looked
 * perfect, and CI failed with fifty "cannot find module" errors.
 *
 * A `.gitignore` that quietly swallows source is a class of bug, not one bug. This test closes
 * the class: it compares the working tree against the index and fails on any source file git is
 * not tracking, whatever pattern caused it.
 */

const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.py',
  '.sql',
  '.css',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.prisma',
  '.sh',
];

/** Generated or vendored trees. Their absence from git is correct, not a mistake. */
const NOT_SOURCE = [
  'node_modules/',
  '.git/',
  '.next/',
  '.venv/',
  '__pycache__/',
  '.pytest_cache/',
  '.ruff_cache/',
  '.egg-info/',
  '/dist/',
  '/out/',
  '/coverage/',
  'package-lock.json',
  '.tsbuildinfo',
];

function git(...args: string[]): string[] {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split('\n')
    .filter((line) => line.trim() !== '');
}

function looksLikeSource(path: string): boolean {
  if (NOT_SOURCE.some((fragment) => path.includes(fragment))) return false;
  return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

describe('every source file is tracked by git', () => {
  it('finds nothing that exists locally but is missing from the repository', () => {
    // `--others` lists untracked files; `--ignored` includes the ones .gitignore hid, which is
    // exactly the case that caused the outage. Without --ignored this test would have passed
    // while the interface was unbuildable from a fresh clone.
    const untracked = git(
      'ls-files',
      '--others',
      '--ignored',
      '--exclude-standard',
      '--directory',
    ).filter(looksLikeSource);

    expect(
      untracked,
      'these files exist locally but no clone of this repository would have them',
    ).toEqual([]);
  });

  it('the four modules that caused the CI failure are tracked', () => {
    const tracked = new Set(git('ls-files', 'apps/web/src/lib'));
    for (const file of [
      'apps/web/src/lib/api-client.ts',
      'apps/web/src/lib/session.ts',
      'apps/web/src/lib/servable-locales.ts',
      'apps/web/src/lib/wire-types.ts',
    ]) {
      expect(tracked.has(file), `${file} must be committed`).toBe(true);
    }
  });

  it('still ignores generated output, so the guard is not simply passing everything', () => {
    const checkIgnored = (path: string): boolean => {
      try {
        execFileSync('git', ['check-ignore', '-q', path], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    };

    for (const generated of ['node_modules/', 'apps/web/.next/', 'services/ai/.venv/']) {
      expect(checkIgnored(generated), `${generated} should stay ignored`).toBe(true);
    }
  });
});

describe('npm scripts run in whatever shell the developer has', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;

  it('never invokes bare `bash`, which on Windows is the WSL launcher', () => {
    // `bash` on a Windows PATH is C:\Windows\System32\bash.exe. With no WSL distro installed it
    // fails with `execvpe(/bin/bash) failed: No such file or directory`, which reads like a broken
    // script rather than the wrong interpreter. scripts/dev-stack.mjs finds the bash Git ships.
    const offenders = Object.entries(scripts)
      .filter(([, command]) => /(^|\s|&&\s*)(bash|sh)\s/.test(command))
      .map(([name, command]) => `${name}: ${command}`);

    expect(offenders, 'run these through scripts/dev-stack.mjs instead').toEqual([]);
  });

  it('keeps the stack commands pointed at the launcher', () => {
    for (const name of ['dev', 'dev:down', 'dev:status']) {
      expect(scripts[name], `${name} is missing`).toBeDefined();
      expect(scripts[name]).toContain('scripts/dev-stack.mjs');
    }
  });
});
