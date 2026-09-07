/**
 * Presentation-only: strip game/brand prefix from product.name for Game product cards.
 * Does NOT mutate API product objects or purchase payloads.
 *
 * Rule: remove prefix only when name starts with brand (case-insensitive),
 * then trim leading separators (space, dash, colon, middot).
 * Otherwise return the original name unchanged.
 */
export function stripGameProductDisplayName(
  productName: string | null | undefined,
  brandName: string | null | undefined
): string {
  const name = typeof productName === 'string' ? productName.trim() : '';
  const brand = typeof brandName === 'string' ? brandName.trim() : '';
  if (!name) return '';
  if (!brand) return name;

  const nameLower = name.toLowerCase();
  const brandLower = brand.toLowerCase();
  if (!nameLower.startsWith(brandLower)) {
    return name;
  }

  let rest = name.slice(brand.length).trimStart();
  rest = rest.replace(/^[\s\-–—:·•|]+/u, '').trimStart();
  return rest.length > 0 ? rest : name;
}
