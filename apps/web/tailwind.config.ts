import type { Config } from 'tailwindcss';

/**
 * The clinical palette.
 *
 * Every semantic colour is a pair, not a single value, and the reason is contrast. The brief's
 * accents — cyan #0EA5E9, amber #F59E0B, emerald #10B981, red #EF4444 — measure 2.9:1, 2.1:1,
 * 2.5:1 and 3.8:1 against white. All four fail WCAG AA as foreground, and this interface uses
 * them as text (`text-urgent` on a badge, `text-accent` on a link) at least as often as fills.
 *
 * So each colour carries:
 *   DEFAULT — dark enough to be read as text on `surface`, and to carry white text as a fill.
 *   bright  — the brief's exact hue, for things nothing is read against: focus rings, the fill of
 *             a progress bar, an active-tab underline, the left edge of a flagged row.
 *   faint   — a tinted background for callouts and badges.
 *   line    — a border that reads as belonging to the family without shouting.
 *
 * `src/__tests__/palette-contrast.test.ts` measures every DEFAULT and fails the build if one
 * drops below 4.5:1, so this comment cannot quietly stop being true.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Slate. `ink-faint` is deliberately slate-500 rather than something lighter: it carries
        // timestamps and case references a doctor has to read, not decoration.
        ink: { DEFAULT: '#0F172A', muted: '#475569', faint: '#64748B', inverse: '#F8FAFC' },
        surface: {
          DEFAULT: '#FFFFFF',
          sunken: '#F8FAFC',
          inset: '#F1F5F9',
          raised: '#FFFFFF',
          deep: '#0F172A',
          deepMuted: '#1E293B',
        },
        line: { DEFAULT: '#E2E8F0', strong: '#CBD5E1', deep: '#334155' },

        accent: {
          DEFAULT: '#0369A1',
          hover: '#075985',
          bright: '#0EA5E9',
          faint: '#E0F2FE',
          line: '#7DD3FC',
        },

        // The four risk tones. `emergency` is reserved for exactly one thing — an emergency red
        // flag — and is used for nothing else, including validation errors.
        emergency: {
          DEFAULT: '#B91C1C',
          hover: '#991B1B',
          bright: '#EF4444',
          faint: '#FEF2F2',
          line: '#FCA5A5',
        },
        urgent: {
          DEFAULT: '#B45309',
          hover: '#92400E',
          bright: '#F59E0B',
          faint: '#FFFBEB',
          line: '#FCD34D',
        },
        caution: {
          DEFAULT: '#854D0E',
          hover: '#713F12',
          bright: '#EAB308',
          faint: '#FEFCE8',
          line: '#FDE047',
        },
        ok: {
          DEFAULT: '#047857',
          hover: '#065F46',
          bright: '#10B981',
          faint: '#ECFDF5',
          line: '#6EE7B7',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Noto Sans',
          'Noto Sans Devanagari',
          'sans-serif',
        ],
        // Case references, dose-free numerics, timestamps — anything that should align in a column.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // A dedicated micro size for table meta and chip text, with its line height pinned so
        // dense rows do not drift.
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      maxWidth: { reading: '38rem', shell: '96rem' },
      boxShadow: {
        // Deliberately shallow. A clinical interface with drop shadows everywhere reads as a
        // marketing site; these separate layers, they do not decorate.
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        raised: '0 4px 6px -1px rgb(15 23 42 / 0.07), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
        overlay: '0 20px 25px -5px rgb(15 23 42 / 0.12), 0 8px 10px -6px rgb(15 23 42 / 0.08)',
      },
      keyframes: {
        'gi-shimmer': { '100%': { transform: 'translateX(100%)' } },
        'gi-rise': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'gi-toast-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'gi-shimmer': 'gi-shimmer 1.6s infinite',
        'gi-rise': 'gi-rise 0.18s ease-out',
        'gi-toast-in': 'gi-toast-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
