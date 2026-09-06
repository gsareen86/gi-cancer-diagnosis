import { describe, expect, it } from 'vitest';
import palette from '../apps/web/tailwind.config';

/**
 * Guards the contrast contract.
 *
 * The clinical brief names its palette by hex, and four of its five accents fail WCAG AA as
 * foreground on white: cyan #0EA5E9 is 2.9:1, amber #F59E0B is 2.1:1, emerald #10B981 is 2.5:1,
 * red #EF4444 is 3.8:1. The interface uses those colours as *text* — a badge label, a link, a
 * flagged row's status word — at least as often as it uses them as fills.
 *
 * So each semantic colour carries a `DEFAULT` dark enough to read and a `bright` holding the
 * brief's hue for things nothing is read against. This test is what stops someone "fixing" a
 * DEFAULT back to the brief's value because it looked more vivid in a mockup.
 *
 * Written as a test rather than a comment because a comment cannot fail CI.
 */

const AA_NORMAL_TEXT = 4.5;

type Hex = string;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: Hex): number {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Hex, b: Hex): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const colors = (palette.theme?.extend?.colors ?? {}) as Record<string, Record<string, string>>;

const SURFACE = colors.surface?.DEFAULT ?? '#FFFFFF';
const SURFACE_SUNKEN = colors.surface?.sunken ?? '#F8FAFC';
const WHITE = '#FFFFFF';

/** Every colour used as foreground text, and the background it is read against. */
const FOREGROUND_TOKENS: Array<[string, string]> = [
  ['ink.DEFAULT', colors.ink?.DEFAULT ?? ''],
  ['ink.muted', colors.ink?.muted ?? ''],
  ['ink.faint', colors.ink?.faint ?? ''],
  ['accent.DEFAULT', colors.accent?.DEFAULT ?? ''],
  ['accent.hover', colors.accent?.hover ?? ''],
  ['emergency.DEFAULT', colors.emergency?.DEFAULT ?? ''],
  ['emergency.hover', colors.emergency?.hover ?? ''],
  ['urgent.DEFAULT', colors.urgent?.DEFAULT ?? ''],
  ['caution.DEFAULT', colors.caution?.DEFAULT ?? ''],
  ['ok.DEFAULT', colors.ok?.DEFAULT ?? ''],
];

/** Colours used as a fill with white text on top: `bg-accent text-white` and its siblings. */
const FILL_TOKENS: Array<[string, string]> = [
  ['accent.DEFAULT', colors.accent?.DEFAULT ?? ''],
  ['accent.hover', colors.accent?.hover ?? ''],
  ['emergency.DEFAULT', colors.emergency?.DEFAULT ?? ''],
  ['emergency.hover', colors.emergency?.hover ?? ''],
  ['surface.deep', colors.surface?.deep ?? ''],
];

/** The tinted callout backgrounds, each read against its own family's DEFAULT. */
const FAINT_PAIRS: Array<[string, string, string]> = [
  ['accent', colors.accent?.DEFAULT ?? '', colors.accent?.faint ?? ''],
  ['emergency', colors.emergency?.DEFAULT ?? '', colors.emergency?.faint ?? ''],
  ['urgent', colors.urgent?.DEFAULT ?? '', colors.urgent?.faint ?? ''],
  ['caution', colors.caution?.DEFAULT ?? '', colors.caution?.faint ?? ''],
  ['ok', colors.ok?.DEFAULT ?? '', colors.ok?.faint ?? ''],
];

describe('the clinical palette meets WCAG 2.1 AA', () => {
  it('measures a known pair correctly, so a pass means something', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // The brief's cyan, which is exactly why `bright` and `DEFAULT` are separate tokens.
    expect(contrast('#0EA5E9', '#FFFFFF')).toBeLessThan(AA_NORMAL_TEXT);
  });

  it.each(FOREGROUND_TOKENS)('%s is legible on the card surface', (name, hex) => {
    expect(hex, `${name} is missing from the palette`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(contrast(hex, SURFACE), `${name} on surface`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it.each(FOREGROUND_TOKENS)('%s is legible on the sunken page background', (name, hex) => {
    expect(contrast(hex, SURFACE_SUNKEN), `${name} on surface-sunken`).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it.each(FILL_TOKENS)('%s carries white text', (name, hex) => {
    expect(contrast(hex, WHITE), `white on ${name}`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it.each(FAINT_PAIRS)('%s reads against its own faint background', (name, fg, bg) => {
    expect(contrast(fg, bg), `${name}.DEFAULT on ${name}.faint`).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it('keeps the brief’s vivid hues available as decorative tokens', () => {
    // These are permitted to fail contrast: nothing is ever read against them.
    expect(colors.accent?.bright).toBe('#0EA5E9');
    expect(colors.emergency?.bright).toBe('#EF4444');
    expect(colors.urgent?.bright).toBe('#F59E0B');
    expect(colors.ok?.bright).toBe('#10B981');
  });

  it('gives every risk tier its own family, so four tiers are four colours', () => {
    const tiers = [
      colors.emergency?.DEFAULT,
      colors.urgent?.DEFAULT,
      colors.caution?.DEFAULT,
      colors.ok?.DEFAULT,
    ];
    expect(new Set(tiers).size).toBe(4);
  });
});
