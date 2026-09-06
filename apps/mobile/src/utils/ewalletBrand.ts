import type { CategoryProviderSummary, Product } from '../services/catalog.service';

/**
 * Mobile port of laravel/app/Services/Catalog/EwalletBrandResolver.php
 * (FR Transfer E-Wallet — brand UX abstraction over PPOB catalog).
 *
 * Matching is space/punctuation-insensitive so "GO PAY" and "GoPay" collapse
 * to the same canonical display name without inventing new brand keys.
 */

const GENERIC_BRANDS = new Set(['e-money', 'emoney', 'e money', 'ewallet', 'e-wallet']);

/** Known wallet keyword → canonical display name (same map as PHP WALLET_NAMES). */
const WALLET_NAMES: Array<[string, string]> = [
  ['shopeepay', 'ShopeePay'],
  ['shopee pay', 'ShopeePay'],
  ['gopay', 'GoPay'],
  ['gojek', 'GoPay'],
  ['ovo', 'OVO'],
  ['dana', 'DANA'],
  ['linkaja', 'LinkAja'],
  ['link aja', 'LinkAja'],
  ['astrapay', 'AstraPay'],
  ['grabpay', 'GrabPay'],
  ['grab', 'GrabPay'],
  ['maxim', 'Maxim'],
  ['isaku', 'i.saku'],
  ['sakuku', 'Sakuku'],
  ['doku', 'DOKU'],
  ['paytren', 'Paytren'],
];

function collapseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isGenericEwalletBrand(brand: string): boolean {
  return GENERIC_BRANDS.has(brand.trim().toLowerCase());
}

/**
 * Resolve wallet display name from product/provider text.
 * Returns null when no known wallet keyword is found (caller keeps original).
 */
export function extractEwalletWallet(productOrProviderName: string): string | null {
  const raw = productOrProviderName.trim();
  if (!raw) return null;
  const hay = raw.toLowerCase();
  const hayCollapsed = collapseKey(raw);

  for (const [needle, displayName] of WALLET_NAMES) {
    if (hay.includes(needle) || hayCollapsed.includes(collapseKey(needle))) {
      return displayName;
    }
  }
  return null;
}

/** Canonical customer-facing brand label for a provider row. */
export function resolveEwalletBrandLabel(providerName: string): string {
  const extracted = extractEwalletWallet(providerName);
  if (extracted) return extracted;
  if (isGenericEwalletBrand(providerName)) return 'E-Wallet';
  return providerName.trim() || 'E-Wallet';
}

export type EwalletBrandGroup = {
  /** Stable key = lowercase canonical label */
  key: string;
  name: string;
  logo: string | null;
  providerIds: number[];
};

/**
 * Deduplicate GET /products/providers rows into one customer-facing brand each.
 * Never exposes product counts to the UI.
 */
export function groupEwalletProviders(
  providers: CategoryProviderSummary[]
): EwalletBrandGroup[] {
  const map = new Map<string, EwalletBrandGroup>();

  for (const p of providers) {
    if (!p?.providerId) continue;
    const name = resolveEwalletBrandLabel(String(p.name ?? ''));
    if (isGenericEwalletBrand(String(p.name ?? '')) && name === 'E-Wallet') {
      // Generic catalog bucket — skip as a destination; brands come from named providers.
      continue;
    }
    const key = name.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name,
        logo: p.logo ?? null,
        providerIds: [p.providerId],
      });
      continue;
    }
    if (!existing.providerIds.includes(p.providerId)) {
      existing.providerIds.push(p.providerId);
    }
    if (!existing.logo && p.logo) {
      existing.logo = p.logo;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

export function isEwalletCekNamaProduct(product: Product): boolean {
  return /cek\s*nama/i.test(product.name || '');
}

export function isEwalletBebasNominalProduct(product: Product): boolean {
  return /bebas\s*nominal/i.test(product.name || '');
}

/**
 * Customer-facing denomination label — mirrors TagihanInquiryService::resolveEwalletDenomination
 * parsing from product name; falls back to catalog selling price.
 */
export function resolveEwalletDenominationAmount(product: Product): number {
  const name = String(product.name || '');
  const m = name.match(/(\d{1,3}(?:[.\s]?\d{3})+|\d+)\s*(ribu|rb|k)?/iu);
  if (m) {
    let n = Number(String(m[1]).replace(/\D/g, ''));
    const suffix = String(m[2] || '').toLowerCase();
    if ((suffix === 'ribu' || suffix === 'rb' || suffix === 'k') && n < 1000) {
      n *= 1000;
    }
    if (n > 0) return n;
  }
  return Math.round(Number(product.price) || 0);
}

/**
 * Resolve internal PPOB SKU for a manually typed transfer amount.
 *
 * Backend inquireEwallet derives Digiflazz `amount` from the product only
 * (TagihanInquiryService::resolveEwalletDenomination) — there is no client
 * `amount` field. Web selects a fixed-denomination SKU; we mirror that by
 * matching typed amount → catalog product denomination.
 *
 * Excludes "Cek Nama" (inquiry-only) and "Bebas Nominal" (cannot pass arbitrary
 * client amount without a backend change).
 */
export function resolveEwalletProductForAmount(
  products: Product[],
  amount: number
): Product | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const candidates = products.filter((p) => {
    if (isEwalletCekNamaProduct(p)) return false;
    if (isEwalletBebasNominalProduct(p)) return false;
    if (!isPurchasableListed(p)) return false;
    return resolveEwalletDenominationAmount(p) === amount;
  });

  if (candidates.length === 0) return null;

  return candidates.slice().sort((a, b) => {
    if (preferProduct(a, b)) return -1;
    if (preferProduct(b, a)) return 1;
    return a.adminFee - b.adminFee;
  })[0];
}

function isPurchasableListed(p: Product): boolean {
  return p.status === 'tersedia' && p.isPurchasable;
}

function preferProduct(next: Product, prev: Product): boolean {
  const nextOk = next.status === 'tersedia' && next.isPurchasable ? 1 : 0;
  const prevOk = prev.status === 'tersedia' && prev.isPurchasable ? 1 : 0;
  if (nextOk !== prevOk) return nextOk > prevOk;
  return next.adminFee < prev.adminFee;
}
