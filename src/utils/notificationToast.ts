import type { ToastType } from '../store/toast.store';
import { toast } from '../hooks/useToast';

/** Backend / UI notification shapes that should surface as dashboard toasts. */
export function mapNotificationToToastType(rawType: unknown, title?: string): ToastType | null {
  const type = String(rawType || '').toLowerCase();
  const t = String(title || '').toLowerCase();

  if (
    type.includes('transaction_success') ||
    type === 'success' ||
    t.includes('pembayaran berhasil') ||
    t.includes('transaksi berhasil') ||
    t.includes('refund berhasil') ||
    t.includes('saldo bertambah')
  ) {
    return 'success';
  }

  if (
    type.includes('transaction_failed') ||
    type.includes('transaction_timeout') ||
    type === 'error' ||
    t.includes('transaksi gagal') ||
    t.includes('pembayaran gagal') ||
    t.includes('transaksi timeout')
  ) {
    return 'error';
  }

  if (
    type === 'warning' ||
    t.includes('menunggu') ||
    t.includes('diproses')
  ) {
    return 'warning';
  }

  if (
    type === 'info' ||
    type === 'transaksi' ||
    t.includes('transaksi dibuat') ||
    t.includes('saldo berkurang')
  ) {
    return 'info';
  }

  // Marketing promo stays in notification center — not forced as toast.
  if (type === 'promo') {
    return null;
  }

  return null;
}

export function enqueueNotificationToast(n: {
  id?: string | number;
  title?: string;
  message?: string;
  type?: string;
  isRead?: boolean;
  is_read?: boolean;
}) {
  const isRead = Boolean(n.isRead ?? n.is_read);
  if (isRead) return;

  const toastType = mapNotificationToToastType(n.type, n.title);
  if (!toastType) return;

  const sourceId = n.id != null ? String(n.id) : undefined;
  toast({
    type: toastType,
    title: String(n.title || 'Notifikasi'),
    description: n.message ? String(n.message) : undefined,
    sourceId,
    durationMs: 15_000,
  });
}
