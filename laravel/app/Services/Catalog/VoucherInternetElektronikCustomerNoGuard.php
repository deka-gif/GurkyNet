<?php

namespace App\Services\Catalog;

use App\Models\Product;
use Illuminate\Validation\ValidationException;

/**
 * Hard-guard: Digi category "Voucher" + mode Elektronik must never send a real MSISDN
 * as Digiflazz customer_no (generate e-code, not top-up phone).
 *
 * Applies to every client (mobile + web) that identifies the purchase as elektronik.
 */
class VoucherInternetElektronikCustomerNoGuard
{
    public function __construct(
        protected VoucherInternetDigiCategoryGate $digiGate
    ) {
    }

    public function assertAllowed(Product $product, string $targetNumber, ?string $voucherInternetMode): void
    {
        if (! $this->digiGate->isVoucherInternetProduct($product)) {
            return;
        }

        $digi = $this->digiGate->resolveDigiCategory($product);
        if ($digi !== VoucherInternetDigiCategoryGate::DIGI_VOUCHER) {
            return;
        }

        $mode = is_string($voucherInternetMode) && trim($voucherInternetMode) !== ''
            ? $this->digiGate->normalizeMode($voucherInternetMode)
            : null;

        // Elektronik context: explicit mode, or Digi Voucher with wallet/dummy/EVOUCHER target
        // (never phone). Phone without mode remains Tembak (legacy / intentional MSISDN top-up).
        $isElektronik = $mode === VoucherInternetDigiCategoryGate::MODE_ELEKTRONIK
            || ($mode === null && $this->isElektronikStyleTarget($targetNumber));

        if (! $isElektronik) {
            return;
        }

        if ($this->looksLikeIndonesianMobile($targetNumber)) {
            throw ValidationException::withMessages([
                'target_number' => [
                    'Mode Voucher Elektronik tidak menerima nomor HP asli sebagai tujuan. Gunakan nomor wallet GurkyPay, dummy, atau EVOUCHER untuk generate kode.',
                ],
            ]);
        }
    }

    public function looksLikeIndonesianMobile(string $raw): bool
    {
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '') {
            return false;
        }

        if (str_starts_with($digits, '62') && strlen($digits) >= 11) {
            $digits = '0'.substr($digits, 2);
        }

        // 08 + operator digit + 7–11 more = typical Indo mobile length.
        return (bool) preg_match('/^08[1-9]\d{7,11}$/', $digits);
    }

    public function isElektronikStyleTarget(string $raw): bool
    {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return false;
        }

        if (strcasecmp($trimmed, 'EVOUCHER') === 0) {
            return true;
        }

        if ($this->looksLikeIndonesianMobile($trimmed)) {
            return false;
        }

        $digits = preg_replace('/\D+/', '', $trimmed) ?? '';

        // GurkyPay wallet numbers (e.g. 1042…) and other non-MSISDN dummies.
        return $digits !== '' && ! $this->looksLikeIndonesianMobile($digits);
    }
}
