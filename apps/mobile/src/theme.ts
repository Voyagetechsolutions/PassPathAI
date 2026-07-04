// PassPath brand: navy + a single confident green accent (used for CTAs,
// progress, and success states alike) — see brand style guide.
export const colors = {
  navy: '#0B2545',
  navy600: '#123262',
  navy50: '#EEF2F7',
  brand: '#16A34A',
  brand50: '#E7F6EC',
  emerald: '#16A34A',
  emerald50: '#E7F6EC',
  warn: '#F59E0B',
  warn50: '#FEF3E2',
  danger: '#DC2626',
  danger50: '#FDECEC',
  ink: '#0F172A',
  ink600: '#334155',
  ink400: '#64748B',
  ink300: '#94A3B8',
  line: '#E8EDF3',
  canvas: '#F8FAFC',
  white: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

/** Poppins, loaded in the root layout. Use these instead of fontWeight (the
 *  weight lives in the font file). */
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const text = {
  h1: { fontSize: 27, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.5, lineHeight: 33 },
  h2: { fontSize: 20, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.3, lineHeight: 26 },
  title: { fontSize: 16, fontFamily: fonts.semibold, color: colors.ink, letterSpacing: -0.1 },
  body: { fontSize: 15, fontFamily: fonts.regular, color: colors.ink600, lineHeight: 22 },
  label: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink400 },
  // ink400 (not ink300): captions must stay readable — light grey on white
  // fails contrast and reads as unfinished.
  caption: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.ink400, lineHeight: 18 },
  section: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.ink400,
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
};

export const shadow = {
  card: {
    shadowColor: '#0B1B33',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};
