import type { WalletMutation } from '../services/wallet.service';

/** Customer-facing money-movement labels — not purchase-history copy. */

export function isCreditMovement(row: Pick<WalletMutation, 'type' | 'direction'>): boolean {
  return String(row.type || row.direction || '')
    .toLowerCase()
    .includes('credit');
}

/**
 * Primary label for Aktivitas Uang.
 * Direction first; refine with backend description keywords only (no invented categories).
 */
export function walletMovementTitle(row: WalletMutation): string {
  const credit = isCreditMovement(row);
  const desc = String(row.description || '').toLowerCase();

  if (desc.includes('adjustment') || desc.includes('penyesuaian')) {
    return 'Penyesuaian Saldo';
  }

  if (credit) {
    if (desc.includes('refund') || desc.includes('dana kembali') || desc.includes('pengembalian')) {
      return 'Refund';
    }
    if (desc.includes('top up') || desc.includes('topup') || desc.includes('isi saldo')) {
      return 'Top Up';
    }
    if (desc.includes('transfer')) return 'Transfer Masuk';
    return 'Uang Masuk';
  }

  if (desc.includes('transfer')) return 'Transfer Keluar';
  if (desc.includes('withdraw') || desc.includes('tarik')) return 'Tarik Dana';
  return 'Uang Keluar';
}

/**
 * Secondary line — backend description, softened for customers.
 * Hides raw technical tokens like "Adjustment (debit)".
 */
export function walletMovementSubtitle(row: WalletMutation): string | null {
  const desc = String(row.description || '').trim();
  if (!desc) return null;

  const lower = desc.toLowerCase();
  if (lower.includes('adjustment') || lower.includes('penyesuaian')) {
    return null;
  }

  return desc;
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
