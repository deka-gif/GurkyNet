import type { CategoryProviderSummary } from '../services/product/product.service';
import { operatorsMatch } from './operatorMatch';

/** Resolve providers-first row for a brand / detected operator label. */
export function findCategoryProviderByName(
  providers: CategoryProviderSummary[],
  name: string | null | undefined
): CategoryProviderSummary | null {
  if (!name) return null;
  return providers.find((p) => operatorsMatch(p.name, name)) ?? null;
}
