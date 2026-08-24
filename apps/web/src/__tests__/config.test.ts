import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { envSchema } from '@/server/env';

/**
 * Configuration loading.
 *
 * This is the bug that made the app unusable on a fresh checkout: `.env` sat at the repository
 * root, where `.env.example` says to put it, and Next.js only reads `.env` from its own project
 * directory. The server started cleanly and then threw on the first registration attempt, which
 * looked like an application fault rather than a missing file.
 *
 * Two failure modes are covered here — the loader not finding an ancestor `.env`, and a required
 * variable being added without documenting it, which would strand the next person the same way.
 */

// fileURLToPath, not URL.pathname — the latter yields '/C:/AI%20Projects/...' on Windows,
// which is not a usable filesystem path.
// src/__tests__/ -> src -> apps/web -> apps -> repository root.
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

describe('ancestor .env loading', () => {
  /**
   * Runs the loader in a child process with a synthetic directory tree.
   *
   * A child process because `process.loadEnvFile` mutates the real environment: doing this
   * in-process would leak fixture values into every test that ran afterwards.
   */
  function loadIn(tree: Record<string, string>, startRelative: string, preset: Record<string, string> = {}) {
    const base = mkdtempSync(join(tmpdir(), 'gi-env-'));
    try {
      for (const [relative, contents] of Object.entries(tree)) {
        const target = join(base, relative);
        mkdirSync(join(target, '..'), { recursive: true });
        writeFileSync(target, contents);
      }
      mkdirSync(join(base, startRelative), { recursive: true });

      const loaderUrl = new URL('../../load-root-env.mjs', import.meta.url).href;
      const script = `
        const { loadAncestorEnvFiles } = await import(${JSON.stringify(loaderUrl)});
        const loaded = loadAncestorEnvFiles(${JSON.stringify(join(base, startRelative))});
        process.stdout.write(JSON.stringify({ loaded, env: process.env }));
      `;
      const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        env: { ...process.env, ...preset },
      });
      return JSON.parse(output) as { loaded: string[]; env: Record<string, string> };
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  }

  it('finds a .env in the repository root when the app runs from apps/web', () => {
    const result = loadIn(
      { '.env': 'GI_TEST_ROOT_ONLY=from-root\n' },
      join('apps', 'web'),
    );

    expect(result.loaded).toHaveLength(1);
    expect(result.env.GI_TEST_ROOT_ONLY).toBe('from-root');
  });

  it('lets the nearer ancestor win, so a per-app override beats the root', () => {
    const result = loadIn(
      {
        '.env': 'GI_TEST_LAYERED=from-root\n',
        [join('apps', '.env')]: 'GI_TEST_LAYERED=from-apps\n',
      },
      join('apps', 'web'),
    );

    expect(result.loaded).toHaveLength(2);
    expect(result.env.GI_TEST_LAYERED).toBe('from-apps');
  });

  it('never overrides a real environment variable', () => {
    // A deployment sets real variables; a stale .env left in a checkout must not beat them.
    const result = loadIn({ '.env': 'GI_TEST_PRECEDENCE=from-file\n' }, join('apps', 'web'), {
      GI_TEST_PRECEDENCE: 'from-real-environment',
    });

    expect(result.env.GI_TEST_PRECEDENCE).toBe('from-real-environment');
  });

  it('is a no-op when there is no ancestor .env at all', () => {
    const result = loadIn({}, join('apps', 'web'));
    expect(result.loaded).toEqual([]);
  });
});

describe('.env.example documents what the app requires', () => {
  const example = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
  const documented = new Set(
    example
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => line.split('=')[0]?.trim() ?? ''),
  );

  const required = Object.entries(envSchema.shape)
    .filter(([, field]) => !field.isOptional())
    .map(([name]) => name)
    // Supplied by the runtime, not by an operator.
    .filter((name) => name !== 'NODE_ENV');

  it('has at least one required variable, so this test is not vacuous', () => {
    expect(required.length).toBeGreaterThan(0);
  });

  it.each(required)('documents %s', (name) => {
    expect(
      documented.has(name),
      `${name} is required at startup but absent from .env.example — anyone setting the project up would hit a boot failure with no idea what to add`,
    ).toBe(true);
  });
});
