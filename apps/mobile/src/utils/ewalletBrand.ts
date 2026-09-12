import type { CategoryProviderSummary, Product } from '../services/catalog.service';

/**
 * Mobile port of laravel/app/Services/Catalog/EwalletBrandResolver.php
 * (FR Transfer E-Wallet — brand UX abstraction over PPOB catalog).
 *
 * Matching is space/punctuation-insensitive so "GO PAY" and "GoPay" collapse
 * to the same canonical display name without inventing new brand keys.
 *
 * GurkyNet E-Wallet uses Digiflazz Pascabayar / Bebas Nominal (open amount) only —
 * never match typed nominal to fixed prepaid denomination SKUs.
 */

const GENERIC_BRANDS = new Set(['e-money', 'emoney', 'e money', 'ewallet', 'e-wallet']);

/**
 * Fallback open-amount limits (same as laravel/config/ewallet.php) when provider
 * summary / ProductResource has not yet exposed min_amount/max_amount.
 */
const OPEN_AMOUNT_LIMITS: Record<string, { min: number; max: number }> = {
  dana: { min: 1, max: 800_000 },
  gopay: { min: 1_000, max: 500_000 },
  linkaja: { min: 1_000, max: 500_000 },
  ovo: { min: 1_000, max: 500_000 },
  shopeepay: { min: 1_000, max: 500_000 },
};

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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
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

/** Min/max for a canonical wallet brand when API omits open-amount metadata. */
export function openAmountLimitsForBrand(brandName: string): { min: number; max: number } | null {
  const key = collapseKey(resolveEwalletBrandLabel(brandName));
  return OPEN_AMOUNT_LIMITS[key] ?? null;
}

export type EwalletBrandGroup = {
  /** Stable key = lowercase canonical label */
  key: string;
  name: string;
  logo: string | null;
  providerIds: number[];
  /** Digiflazz Bebas Nominal SKU from API (required for open-amount flow). */
  skuCode: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  isOpenAmount: boolean;
};

/**
 * Deduplicate GET /products/providers rows into one customer-facing brand each.
 * Prefer API-canonical rows (already merged + open-amount metadata).
 */
export function groupEwalletProviders(
  providers: CategoryProviderSummary[]
): EwalletBrandGroup[] {
  const map = new Map<string, EwalletBrandGroup>();

  for (const p of providers) {
    if (!p?.providerId) continue;
    const name = resolveEwalletBrandLabel(String(p.name ?? ''));
    if (isGenericEwalletBrand(String(p.name ?? '')) && name === 'E-Wallet') {
      continue;
    }
    const key = name.toLowerCase();
    const apiIds =
      Array.isArray(p.providerIds) && p.providerIds.length > 0
        ? p.providerIds.filter((id) => Number.isFinite(id) && id > 0)
        : [p.providerId];
    const skuCode = typeof p.sku_code === 'string' && p.sku_code ? p.sku_code : null;
    const minAmount =
      typeof p.min_amount === 'number' && Number.isFinite(p.min_amount) ? p.min_amount : null;
    const maxAmount =
      typeof p.max_amount === 'number' && Number.isFinite(p.max_amount) ? p.max_amount : null;
    const isOpenAmount = p.is_open_amount === true || Boolean(skuCode);

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name,
        logo: p.logo ?? null,
        providerIds: [...apiIds],
        skuCode,
        minAmount,
        maxAmount,
        isOpenAmount,
      });
      continue;
    }
    for (const id of apiIds) {
      if (!existing.providerIds.includes(id)) existing.providerIds.push(id);
    }
    if (!existing.logo && p.logo) existing.logo = p.logo;
    if (!existing.skuCode && skuCode) existing.skuCode = skuCode;
    if (existing.minAmount == null && minAmount != null) existing.minAmount = minAmount;
    if (existing.maxAmount == null && maxAmount != null) existing.maxAmount = maxAmount;
    if (isOpenAmount) existing.isOpenAmount = true;
  }

  return Array.from(map.values())
    .filter((b) => {
      // Fix #3 API: fully configured Bebas Nominal brand.
      if (b.skuCode && b.minAmount != null && b.maxAmount != null) return true;
      // Legacy/partial provider summary (no open-amount meta yet): still show known
      // Digi E-Money wallet brands so the menu is not empty — SKU/limits resolve in flow.
      return extractEwalletWallet(b.name) != null;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

export function isEwalletCekNamaProduct(product: Product): boolean {
  return /cek\s*nama/i.test(product.name || '');
}

export function isEwalletBebasNominalProduct(product: Product): boolean {
  if (product.is_open_amount === true) return true;
  return /bebas\s*nominal/i.test(product.name || '');
}

/**
 * Resolve Digiflazz Pascabayar / Bebas Nominal SKU for the brand catalog.
 * Never matches typed amount to fixed prepaid denominations.
 */
export function resolveEwalletOpenAmountProduct(
  products: Product[],
  preferredSkuCode?: string | null
): Product | null {
  const preferred = preferredSkuCode?.trim();
  if (preferred) {
    const hit = products.find(
      (p) =>
        p?.code === preferred &&
        isEwalletBebasNominalProduct(p) &&
        !isEwalletCekNamaProduct(p) &&
        isPurchasableListed(p)
    );
    if (hit) return hit;
  }

  const candidates = products.filter(
    (p) =>
      isEwalletBebasNominalProduct(p) && !isEwalletCekNamaProduct(p) && isPurchasableListed(p)
  );
  if (candidates.length === 0) return null;

  return candidates.slice().sort((a, b) => {
    if (preferProduct(a, b)) return -1;
    if (preferProduct(b, a)) return 1;
    return a.adminFee - b.adminFee;
  })[0];
}

export function validateEwalletOpenAmount(
  amount: number,
  minAmount: number | null | undefined,
  maxAmount: number | null | undefined
): string | null {
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return 'Masukkan nominal transfer';
  }
  if (minAmount == null || maxAmount == null || minAmount <= 0 || maxAmount < minAmount) {
    return 'Batas nominal belum tersedia. Coba pilih brand lagi.';
  }
  if (amount < minAmount) {
    return `Minimal Rp${minAmount.toLocaleString('id-ID')}`;
  }
  if (amount > maxAmount) {
    return `Maksimal Rp${maxAmount.toLocaleString('id-ID')}`;
  }
  // Digiflazz E-Money RC 87 — face amount must be a multiple of Rp1.000.
  if (amount % 1000 !== 0) {
    return 'Nominal harus kelipatan Rp1.000';
  }
  return null;
}

function isPurchasableListed(p: Product): boolean {
  return p.status === 'tersedia' && p.isPurchasable;
}

function preferProduct(next: Product, prev: Product): boolean {
  const nextOk = next.status === 'tersedia' && next.isPurchasable ? 1 : 0;
  const prevOk = prev.status === 'tersedia' && prev.isPurchasable ? 1 : 0;
  if (nextOk !== prevOk) return nextOk > prevOk;
  return false;
}
