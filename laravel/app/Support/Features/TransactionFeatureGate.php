<?php

namespace App\Support\Features;

/**
 * Sprint 8 / SRS 20 + .cursorrules #8 — central purchase/withdraw/auto-topup gates.
 */
class TransactionFeatureGate
{
    public function purchaseEnabled(): bool
    {
        return (bool) config('features.purchase_enabled', false);
    }

    public function withdrawEnabled(): bool
    {
        return (bool) config('features.withdraw_enabled', false);
    }

    public function autoTopupEnabled(): bool
    {
        return (bool) config('features.auto_topup_enabled', false);
    }

    public function purchaseDisabledMessage(): string
    {
        return 'Fitur pembelian produk segera hadir. Transaksi yang memotong saldo belum diaktifkan.';
    }

    public function withdrawDisabledMessage(): string
    {
        return 'Fitur penarikan dana segera hadir. Withdraw belum diaktifkan untuk publik.';
    }

    public function autoTopupDisabledMessage(): string
    {
        return 'Top up otomatis (VA/QRIS) segera hadir. Gunakan transfer manual dengan unggah bukti untuk saat ini.';
    }

    /**
     * @return array{purchase_enabled:bool,withdraw_enabled:bool,auto_topup_enabled:bool,messages:array<string,string>}
     */
    public function snapshot(): array
    {
        return [
            'purchase_enabled' => $this->purchaseEnabled(),
            'withdraw_enabled' => $this->withdrawEnabled(),
            'auto_topup_enabled' => $this->autoTopupEnabled(),
            'messages' => [
                'purchase' => $this->purchaseDisabledMessage(),
                'withdraw' => $this->withdrawDisabledMessage(),
                'auto_topup' => $this->autoTopupDisabledMessage(),
            ],
        ];
    }
}
