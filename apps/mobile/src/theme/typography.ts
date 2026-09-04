/**
 * Counter staff read these screens dozens of times a day — sizes lean slightly larger
 * and heavier than a typical consumer app for fast at-a-glance scanning (spec section 4/32).
 */
export const typography = {
  fontFamily: {
    regular: undefined, // system default; a custom "Plus Jakarta Sans" font can be linked later
  },
  size: {
    xs: 12,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 34,
  },
  weight: {
    regular: '400' as const,
    medium: '600' as const,
    bold: '700' as const,
    black: '800' as const,
  },
};
