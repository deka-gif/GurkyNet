/**
 * Ported from src/index.css (@theme block) so the mobile app uses the exact same
 * GurkyNet brand scale as the web dashboard — not a re-derived approximation.
 */
export const colors = {
  primary: {
    50: '#edfcf6',
    100: '#d2f7e8',
    200: '#a6efd1',
    300: '#6fe0b4',
    400: '#3bc994',
    500: '#1fa87a',
    600: '#128560',
    700: '#0f6a4d',
    800: '#0d5341',
    900: '#0b3d36',
  },
  accent: {
    300: '#f8e3b0',
    400: '#f3ce7a',
    500: '#e8b84b',
    600: '#c99730',
  },
  status: {
    success: '#128560',
    successBg: '#edfcf6',
    pending: '#c99730',
    pendingBg: '#fdf6e8',
    failed: '#dc2626',
    failedBg: '#fef2f2',
    info: '#1fa87a',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  white: '#ffffff',
  black: '#000000',
} as const;
