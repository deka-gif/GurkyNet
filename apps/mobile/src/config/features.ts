/**
 * Mirror of web `src/config/features.ts` — fail-closed defaults until GET /features
 * confirms otherwise (Laravel TransactionFeatureGate / FR-USR02 safety).
 */

export type FeatureFlags = {
  purchase_enabled: boolean;
  withdraw_enabled: boolean;
  auto_topup_enabled: boolean;
  messages: {
    purchase: string;
    withdraw: string;
    auto_topup: string;
  };
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  purchase_enabled: false,
  withdraw_enabled: false,
  auto_topup_enabled: false,
  messages: {
    purchase:
      'Fitur pembelian produk segera hadir. Transaksi yang memotong saldo belum diaktifkan.',
    withdraw: 'Fitur penarikan dana segera hadir. Withdraw belum diaktifkan untuk publik.',
    auto_topup:
      'Top up otomatis (VA/QRIS) segera hadir. Gunakan transfer manual dengan unggah bukti untuk saat ini.',
  },
};
