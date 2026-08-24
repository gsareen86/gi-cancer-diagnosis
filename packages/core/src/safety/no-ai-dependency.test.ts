import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Structural guard for the spec requirement that the AI pipeline is never on the emergency
 * critical path. A patient who may be actively bleeding cannot wait on a model call, so the
 * red-flag evaluator and everything it transitively imports must stay free of network,
 * asynchrony, and any AI client.
 *
 * This is asserted over the import graph rather than by mocking, because a mock proves only
 * that today's code path avoided the call — this proves the dependency cannot exist at all.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '..');

function resolveImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  // Imports are extensionless, so try `.ts` and then `/index.ts`.
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

function transitiveImports(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      const resolved = resolveImport(file, specifier);
      if (resolved) queue.push(resolved);
    }
  }
  return [...seen];
}

/**
 * Comments are stripped before matching. Prose like "awaiting sign-off" is not asynchrony,
 * and a guard that cries wolf on documentation gets deleted rather than fixed.
 */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FORBIDDEN_MODULE_PATTERNS = [
  /from\s+'(node:)?http[s]?'/,
  /from\s+'(node:)?net'/,
  /from\s+'undici'/,
  /from\s+'axios'/,
  /from\s+'@anthropic-ai\//,
  /from\s+'openai'/,
  /from\s+'@prisma\//,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
];

const FORBIDDEN_ASYNC_PATTERNS = [/\basync\s+function\b/, /\bawait\s/, /\bnew Promise\b/, /=>\s*Promise\./];

describe('the emergency path cannot reach the AI pipeline', () => {
  const entry = join(srcRoot, 'safety', 'red-flags.ts');
  const graph = transitiveImports(entry).filter((file) => !file.endsWith('.test.ts'));

  it('pulls in only the condition grammar, the answer types, and the taxonomy', () => {
    const relative = graph.map((file) => file.slice(srcRoot.length + 1)).sort();
    expect(relative).toEqual([
      'conditions/evaluate.ts',
      'conditions/grammar.ts',
      'conditions/introspect.ts',
      'questionnaire/answers.ts',
      'safety/red-flags.ts',
      'taxonomy.ts',
    ]);
  });

  it.each(FORBIDDEN_MODULE_PATTERNS.map((pattern) => [pattern.source, pattern] as const))(
    'imports nothing matching %s anywhere in that graph',
    (_label, pattern) => {
      const offenders = graph.filter((file) => pattern.test(code(file)));
      expect(offenders).toEqual([]);
    },
  );

  it.each(FORBIDDEN_ASYNC_PATTERNS.map((pattern) => [pattern.source, pattern] as const))(
    'contains no asynchrony matching %s, so escalation cannot be deferred',
    (_label, pattern) => {
      const offenders = graph.filter((file) => pattern.test(code(file)));
      expect(offenders).toEqual([]);
    },
  );

  it('covers every source file in the graph — the walk is not silently empty', () => {
    expect(graph.length).toBeGreaterThanOrEqual(5);
  });
});

describe('the domain core as a whole stays framework-free', () => {
  const collect = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      return entry.isFile() && full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
    });

  it('imports no framework, database client, or HTTP client', () => {
    const forbidden = [/from\s+'react'/, /from\s+'next\//, /from\s+'@prisma\//, /from\s+'express'/];
    const offenders: string[] = [];
    for (const file of collect(srcRoot)) {
      const source = code(file);
      if (forbidden.some((pattern) => pattern.test(source))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
