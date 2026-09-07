/**
 * Deterministic A–Z sort for Game (and other) provider/brand lists.
 * Case-insensitive localeCompare — defensive even if API already sorts.
 */
export function sortProvidersByNameAsc<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    String(a.name ?? '').localeCompare(String(b.name ?? ''), 'id', { sensitivity: 'base' })
  );
}
