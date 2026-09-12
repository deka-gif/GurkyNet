import { useCheckoutStore } from '../store/checkout.store';
import { transactionService } from './transaction.service';
import {
  pushHintMatchesCheckoutTransaction,
  type TransactionPushHint,
} from '../utils/transactionStatusFromPush';

/**
 * GET latest transaction for the checkout store when a push hint matches.
 * Never POSTs. Safe after poll timeout — used by all pending product flows.
 */
export async function syncCheckoutTransactionFromPushHint(
  hint: TransactionPushHint
): Promise<'updated' | 'skipped' | 'error'> {
  const state = useCheckoutStore.getState();
  const current = state.transaction;
  if (!pushHintMatchesCheckoutTransaction(current, hint) || !current) {
    return 'skipped';
  }

  try {
    const res = await transactionService.getById(current.id);
    if (!res.success || !res.data) return 'error';
    state.setTransaction(res.data);
    state.setStatus(res.data.status);
    return 'updated';
  } catch {
    return 'error';
  }
}
