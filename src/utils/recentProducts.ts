import type { Transaction } from '../types';

function mapRoute(category?: string): string {
  const c = (category || '').toLowerCase();
  if (c.includes('pulsa') && !c.includes('international')) return '/dashboard/pulsa';
  if (c === 'data' || c.includes('paket')) return '/dashboard/paket-data';
  if (c.includes('voucher-internet')) return '/dashboard/voucher-internet';
  if (c === 'pln' || c.includes('token') || c.includes('listrik')) return '/dashboard/token-pln';
  if (c.includes('topup') || c.includes('ewallet') || c.includes('e-wallet')) {
    return '/dashboard/topup-digital';
  }
  if (c.includes('game')) return '/dashboard/game';
  if (c.includes('langganan') || c.includes('streaming')) return '/dashboard/langganan-digital';
  if (c.includes('international')) return '/dashboard/international';
  if (c.includes('voucher')) return '/dashboard/voucher-digital';
  if (c.includes('transfer')) return '/dashboard/transfer';
  if (c.includes('tagihan') || c.includes('bpjs') || c.includes('pdam')) {
    return '/dashboard/tagihan';
  }
  return '/dashboard';
}

export type RecentProductItem = {
  key: string;
  productName: string;
  serviceName: string;
  targetNo?: string;
  amount: number;
  date: string;
  categoryHint: string;
  route: string;
};

/**
 * Build unique recent products from user transactions (newest first).
 * Pure helper — no API changes.
 */
export function buildRecentProductsFromTransactions(
  transactions: Transaction[],
  limit = 8
): RecentProductItem[] {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const sorted = [...transactions].sort((a, b) => {
    const ta = new Date(a.date || 0).getTime();
    const tb = new Date(b.date || 0).getTime();
    return tb - ta;
  });

  const seen = new Set<string>();
  const out: RecentProductItem[] = [];

  for (const tx of sorted) {
    const productName = (tx.productName || '').trim();
    const serviceName = (tx.serviceName || '').trim();
    if (!productName && !serviceName) continue;

    const key = `${serviceName}::${productName}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const hint = `${serviceName} ${productName}`.toLowerCase();
    out.push({
      key,
      productName: productName || serviceName || 'Produk',
      serviceName: serviceName || 'PPOB',
      targetNo: tx.targetNo,
      amount: tx.amount || 0,
      date: tx.date || '',
      categoryHint: hint,
      route: mapRoute(hint),
    });

    if (out.length >= limit) break;
  }

  return out;
}
