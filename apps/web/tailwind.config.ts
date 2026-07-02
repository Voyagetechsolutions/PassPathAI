import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#17375E', 600: '#1E456F', 50: '#EEF2F7' },
        brand: { DEFAULT: '#2F80ED', 600: '#2670D6', 50: '#EAF2FE' },
        emerald: { DEFAULT: '#27AE60', 50: '#E7F6EE' },
        warn: { DEFAULT: '#F2994A', 50: '#FDF1E7' },
        danger: { DEFAULT: '#EB5757', 50: '#FDECEC' },
        ink: { DEFAULT: '#0F172A', 600: '#334155', 400: '#64748B', 300: '#94A3B8' },
        line: '#E8EDF3',
        canvas: '#F8FAFC',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        lift: '0 4px 16px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
