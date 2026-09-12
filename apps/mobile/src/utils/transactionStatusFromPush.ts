/**
 * Push → authoritative status refresh for the in-flight checkout transaction.
 * Used by all pending/poll flows (Pulsa, Paket Data, E-Wallet, …) — not ShopeePay-only.
 * Always GET /transactions/:id — never re-POSTs a purchase.
 */

export type TransactionPushHint = {
  transactionId?: string | null;
  invoiceNumber?: string | null;
};

export type CheckoutTxHintMatch = {
  id: string;
  transactionCode?: string | null;
  status: string;
};

const TERMINAL = new Set(['success', 'failed', 'expired', 'cancelled', 'canceled', 'refunded']);

export function isTerminalTransactionStatus(status: string): boolean {
  return TERMINAL.has(String(status || '').toLowerCase());
}

/** True when push payload points at the checkout transaction currently on screen / in store. */
export function pushHintMatchesCheckoutTransaction(
  tx: CheckoutTxHintMatch | null | undefined,
  hint: TransactionPushHint
): boolean {
  if (!tx?.id) return false;
  const hintId = hint.transactionId != null ? String(hint.transactionId).trim() : '';
  const hintInvoice = hint.invoiceNumber != null ? String(hint.invoiceNumber).trim() : '';
  if (!hintId && !hintInvoice) return false;

  if (hintId && String(tx.id) === hintId) return true;

  const code = String(tx.transactionCode || '').trim();
  if (hintInvoice && code && code === hintInvoice) return true;

  return false;
}

/** Whether this push is a transaction-final (or transaction-related) status hint. */
export function isTransactionPushHint(hint: {
  category?: string | null;
  type?: string | null;
  transactionId?: string | null;
  invoiceNumber?: string | null;
}): boolean {
  const category = String(hint.category || hint.type || '')
    .trim()
    .toLowerCase();
  if (category === 'transaction') return true;
  return Boolean(hint.transactionId || hint.invoiceNumber);
}
