import type { CheckoutData } from '../components/CheckoutSummary';

export const PENDING_CHECKOUT_KEY = 'gn_pending_checkout';
export const PENDING_TRANSFER_KEY = 'gn_pending_transfer';
export const PENDING_WALLET_ACTION_KEY = 'gn_pending_wallet_action';

export type PendingCheckout = {
  data: CheckoutData;
  returnPath: string;
  resumePin?: boolean;
};

export function savePendingCheckout(data: CheckoutData, returnPath: string): void {
  sessionStorage.setItem(
    PENDING_CHECKOUT_KEY,
    JSON.stringify({ data, returnPath, resumePin: true, savedAt: Date.now() })
  );
}

export function consumePendingCheckout(expectedPath?: string): PendingCheckout | null {
  const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCheckout;
    if (expectedPath && parsed.returnPath !== expectedPath) {
      return null;
    }
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    return parsed;
  } catch {
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    return null;
  }
}

export function buildCreatePinUrl(returnTo: string): string {
  return `/dashboard/account/pin/create?returnTo=${encodeURIComponent(returnTo)}`;
}
