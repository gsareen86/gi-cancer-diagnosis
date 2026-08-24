import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the i18n layer.
 *
 * Every patient-facing string has to come from the catalogue. A single hardcoded label is not a
 * cosmetic slip: it is a sentence a Hindi-speaking patient reads in English, in the middle of a
 * clinical question, with no indication that anything is missing.
 *
 * Written as a test rather than a lint rule so it actually runs — in CI, on every change, with
 * the same command as everything else.
 */

// fileURLToPath, not URL.pathname — on Windows the latter yields '/C:/AI%20Projects/...',
// which resolves to a nonexistent 'C:\C:\AI%20Projects' and made this guard error out
// instead of running.
const SRC = fileURLToPath(new URL('../', import.meta.url));
const COMPONENTS = join(SRC, 'components');
const APP = join(SRC, 'app');

function collect(dir: string, predicate: (path: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collect(full, predicate);
    return entry.isFile() && predicate(full) ? [full] : [];
  });
}

/** Files that render for a patient, doctor, or admin. API route handlers send keys, not prose. */
function patientFacingFiles(): string[] {
  const isTsx = (path: string) => path.endsWith('.tsx');
  return [
    ...collect(COMPONENTS, isTsx),
    ...collect(APP, (path) => isTsx(path) && !path.includes(`${'/'}api${'/'}`)),
  ];
}

/**
 * JSX text nodes that are not a translation call, an expression, or punctuation.
 *
 * Deliberately conservative: it looks for runs of letters between tags. Single symbols, numbers,
 * and interpolations are not display prose and are not flagged.
 */
const JSX_TEXT = />(\s*[A-Za-z][A-Za-z0-9 ,.'’!?—–-]{3,})</g;

/** Attributes whose value is read aloud or displayed, so they need the catalogue too. */
const DISPLAY_ATTRIBUTES = /\b(?:placeholder|aria-label|title|alt)\s*=\s*"([^"]{4,})"/g;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

interface Finding {
  file: string;
  text: string;
}

function findHardcoded(files: string[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'));

    for (const match of source.matchAll(JSX_TEXT)) {
      const text = match[1]?.trim() ?? '';
      if (text === '') continue;
      findings.push({ file: relative(SRC, file), text });
    }

    for (const match of source.matchAll(DISPLAY_ATTRIBUTES)) {
      const text = match[1]?.trim() ?? '';
      // A catalogue key or a path is not display prose.
      if (text === '' || text.startsWith('/') || /^[a-z0-9_.-]+$/.test(text)) continue;
      findings.push({ file: relative(SRC, file), text });
    }
  }
  return findings;
}

describe('patient-facing text comes from the catalogue', () => {
  it('finds no hardcoded display strings', () => {
    const findings = findHardcoded(patientFacingFiles());
    expect(
      findings.map((finding) => `${finding.file}: "${finding.text}"`),
      'these strings would render the same in every language',
    ).toEqual([]);
  });

  it('actually scans the interface — the walk is not silently empty', () => {
    const files = patientFacingFiles();
    expect(files.length).toBeGreaterThan(15);
    expect(files.some((file) => file.includes('interview'))).toBe(true);
    expect(files.some((file) => file.includes('emergency'))).toBe(true);
  });

  it('catches a hardcoded string when one is introduced', () => {
    // Proves the matcher bites, so a passing suite means something.
    const fixture = 'const x = <p>Please seek urgent care now</p>;';
    expect([...stripComments(fixture).matchAll(JSX_TEXT)].length).toBeGreaterThan(0);
  });

  it('does not flag a translation call or an interpolation', () => {
    const fixture = "const x = <p>{t('emergency.heading')}</p>;\nconst y = <p>{value}</p>;";
    expect([...stripComments(fixture).matchAll(JSX_TEXT)].length).toBe(0);
  });
});
