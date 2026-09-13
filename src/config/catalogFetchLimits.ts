/**
 * Soft caps for web catalog fetches — avoid unbounded `per_page: 5000` (audit Item 6).
 */
export const WEB_CATALOG_FETCH = {
  SMALL_CATEGORY: 100,
  GENERAL: 200,
  PICKER: 200,
} as const;
