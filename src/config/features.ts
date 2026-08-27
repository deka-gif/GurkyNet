/**
 * Sprint 8 — FE mirror of server feature gates (FR-USR02/03 safety).
 * Source of truth remains Laravel config/features.php via GET /api/v1/features.
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
    purchase: 'Fitur pembelian produk segera hadir. Transaksi yang memotong saldo belum diaktifkan.',
    withdraw: 'Fitur penarikan dana segera hadir. Withdraw belum diaktifkan untuk publik.',
    auto_topup: 'Top up otomatis (VA/QRIS) segera hadir. Gunakan transfer manual dengan unggah bukti untuk saat ini.',
  },
};
