import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/**
 * Loads `.env` files from directories *above* this app.
 *
 * Next.js reads `.env` files from its own project directory and does not walk up, so in a
 * monorepo a `.env` at the repository root is invisible to `next dev`, `next build`, and
 * `next start`. That is a quiet failure: the server boots fine and then throws on the first
 * request that touches configuration, which reads like an application bug rather than a missing
 * file.
 *
 * Ancestors only — `apps/web/.env` is Next's own job, and duplicating it here would fight its
 * precedence rules.
 *
 * Precedence, strongest first:
 *   1. Real environment variables (a container, systemd, a PaaS)
 *   2. `apps/web/.env*`, loaded by Next itself
 *   3. The nearest ancestor `.env`
 *   4. `.env` further up
 *
 * `process.loadEnvFile` never overwrites a variable that is already set, so loading
 * nearest-ancestor-first gives specific-beats-general, and a real deployment's environment always
 * wins over a stray file left in a checkout.
 */
export function loadAncestorEnvFiles(startDir) {
  const loaded = [];
  const { root } = parse(startDir);

  let current = dirname(startDir);
  for (;;) {
    const candidate = join(current, '.env');
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
        loaded.push(candidate);
      } catch (error) {
        // A malformed or unreadable .env must not take the build down silently, but it must be
        // visible: a half-loaded configuration is worse than none.
        console.warn(`[env] could not load ${candidate}: ${String(error)}`);
      }
    }

    if (current === root) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return loaded;
}
