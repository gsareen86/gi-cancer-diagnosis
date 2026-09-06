import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the message catalogue against the two ways it silently rots.
 *
 * **A key the interface asks for and the catalogue does not have.** `next-intl` renders the key
 * itself, so `doctor.riskCritical` appears on screen where "Critical" should be. It looks like a
 * styling bug and gets triaged as one.
 *
 * **A key English has and Hindi does not.** That one is worse, because it degrades to English
 * rather than to nonsense: a Hindi-speaking patient reads a Hindi questionnaire with an English
 * sentence in the middle of it, and nothing anywhere reports a problem.
 *
 * The scanner is deliberately conservative. It resolves each `t('key')` call against the nearest
 * *preceding* `useTranslations('ns')` binding of that identifier — component files routinely bind
 * `t` to one namespace at the top and to another inside a helper below, and cross-producing every
 * binding against every call site invents keys neither namespace ever asks for. Computed keys
 * like `t(RISK_LABEL_KEY[tier])` cannot be checked statically and are skipped rather than guessed
 * at, which is why the risk and status maps live next to their usage where a reader can check
 * them by eye.
 */

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(ROOT, 'apps', 'web', 'src');
const MESSAGES = join(ROOT, 'apps', 'web', 'messages');

function collect(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    return entry.isFile() && (full.endsWith('.tsx') || full.endsWith('.ts')) ? [full] : [];
  });
}

/** Flattened to dotted paths, because catalogue namespaces nest — `emergency.number.general`. */
function flatten(value: unknown, prefix: string, into: Set<string>): void {
  if (value === null || typeof value !== 'object') {
    into.add(prefix);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flatten(child, prefix === '' ? key : `${prefix}.${key}`, into);
  }
}

function loadCatalogue(locale: string): Set<string> {
  const raw = JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), 'utf8')) as unknown;
  const keys = new Set<string>();
  flatten(raw, '', keys);
  return keys;
}

/** `const t = useTranslations('doctor')`, or the root form with no namespace. */
const BINDING =
  /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:'([^']*)')?\s*\)/g;
/** Any single-quoted literal key passed to a translator-shaped call. */
const CALL = /\b(\w+)\(\s*'([A-Za-z][\w.]*)'/g;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

interface Usage {
  file: string;
  key: string;
}

function usages(): Usage[] {
  const found: Usage[] = [];

  for (const file of collect(SRC)) {
    if (file.includes('__tests__')) continue;
    const source = stripComments(readFileSync(file, 'utf8'));

    // Every binding in the file, in source order: identifier, namespace (null for root), offset.
    const bindings: Array<{ name: string; namespace: string | null; at: number }> = [];
    for (const match of source.matchAll(BINDING)) {
      if (match[1] === undefined) continue;
      bindings.push({ name: match[1], namespace: match[2] ?? null, at: match.index ?? 0 });
    }
    if (bindings.length === 0) continue;

    for (const call of source.matchAll(CALL)) {
      const name = call[1];
      const key = call[2];
      const at = call.index ?? 0;
      if (name === undefined || key === undefined) continue;

      // The nearest binding of this identifier at or before the call site.
      let resolved: (typeof bindings)[number] | undefined;
      for (const binding of bindings) {
        if (binding.name === name && binding.at <= at) resolved = binding;
      }
      if (resolved === undefined) continue;

      if (resolved.namespace === null) {
        // A root translator's keys are already fully qualified; an unqualified literal is some
        // other function that happens to share the name.
        if (key.includes('.')) found.push({ file: relative(ROOT, file), key });
      } else {
        found.push({ file: relative(ROOT, file), key: `${resolved.namespace}.${key}` });
      }
    }
  }
  return found;
}

describe('the message catalogue covers the interface', () => {
  it('scans real files — the walk is not silently empty', () => {
    expect(usages().length).toBeGreaterThan(100);
  });

  it('has an English entry for every literal key the interface asks for', () => {
    const english = loadCatalogue('en');
    const missing = usages()
      .filter((usage) => !english.has(usage.key))
      .map((usage) => `${usage.file}: ${usage.key}`);

    expect([...new Set(missing)].sort(), 'these would render as the key itself').toEqual([]);
  });

  it('has the same key set in Hindi as in English', () => {
    const english = loadCatalogue('en');
    const hindi = loadCatalogue('hi');

    const missingHindi = [...english].filter((key) => !hindi.has(key)).sort();
    const extraHindi = [...hindi].filter((key) => !english.has(key)).sort();

    expect(missingHindi, 'these would silently fall back to English mid-sentence').toEqual([]);
    expect(extraHindi, 'these are translated but unreachable').toEqual([]);
  });
});
