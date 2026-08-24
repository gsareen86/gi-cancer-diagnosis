import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // A clinical palette: calm by default, with one unmistakable emergency red that is
        // used for nothing else.
        ink: { DEFAULT: '#12212b', muted: '#4a5b66', faint: '#8194a0' },
        surface: { DEFAULT: '#ffffff', sunken: '#f4f7f9', raised: '#ffffff' },
        line: { DEFAULT: '#dde5ea', strong: '#c2cfd7' },
        accent: { DEFAULT: '#0f6d8c', hover: '#0b586f', faint: '#e6f2f6' },
        emergency: { DEFAULT: '#b3261e', faint: '#fdecea' },
        urgent: { DEFAULT: '#9a5b00', faint: '#fdf3e3' },
        ok: { DEFAULT: '#1f6b45', faint: '#e8f4ed' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'sans-serif'],
      },
      maxWidth: { reading: '38rem' },
    },
  },
  plugins: [],
} satisfies Config;
