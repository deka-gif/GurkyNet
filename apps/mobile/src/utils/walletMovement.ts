import type { WalletMutation } from '../services/wallet.service';

/** Customer-facing money-movement labels — Wallet mutasi, not Riwayat pembelian. */

export function isCreditMovement(row: Pick<WalletMutation, 'type' | 'direction'>): boolean {
  return String(row.type || row.direction || '')
    .toLowerCase()
    .includes('credit');
}

/**
 * Primary label for Aktivitas Uang — emphasize money in/out only.
 * Adjustment credit/debit → Penyesuaian Saldo (no fake purchase categories).
 */
export function walletMovementTitle(row: WalletMutation): string {
  const desc = String(row.description || '').toLowerCase();
  if (desc.includes('adjustment') || desc.includes('penyesuaian')) {
    return 'Penyesuaian Saldo';
  }
  return isCreditMovement(row) ? 'Uang Masuk' : 'Uang Keluar';
}

/** Optional timestamp only — hide product-style descriptions from Wallet list. */
export function walletMovementSubtitle(_row: WalletMutation): string | null {
  return null;
}

export function formatWalletWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
