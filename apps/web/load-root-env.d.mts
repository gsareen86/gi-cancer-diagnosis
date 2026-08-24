/**
 * Types for `load-root-env.mjs`.
 *
 * The implementation stays plain JavaScript because `next.config.mjs` imports it, and Next's
 * config is loaded by Node before any TypeScript tooling is in play.
 */

/**
 * Loads `.env` files from directories above `startDir`, nearest ancestor first, and returns the
 * paths that were read. Never overwrites a variable that is already set.
 */
export function loadAncestorEnvFiles(startDir: string): string[];
