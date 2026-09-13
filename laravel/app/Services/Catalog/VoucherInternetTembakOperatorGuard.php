<?php

namespace App\Services\Catalog;

use App\Models\Product;
use Illuminate\Validation\ValidationException;

/**
 * Backend second line for Voucher Internet Tembak Langsung:
 * reject MSISDN prefix vs SKU brand mismatch before Digiflazz.
 *
 * Mirrors mobile/web detectOperator.ts prefixes + operatorMatch keys.
 * Client UX check stays; this is not a replacement.
 *
 * TD-2026-09-13-VI-TEMBAK / TD-2026-09-13-H2H-OP / TD-2026-09-13-PREFIX
 */
class VoucherInternetTembakOperatorGuard
{
    /** @var list<string> */
    public const KNOWN_KEYS = [
        'telkomsel',
        'indosat',
        'xl',
        'tri',
        'axis',
        'smartfren',
        'byu',
    ];

    public function __construct(
        protected VoucherInternetDigiCategoryGate $digiGate,
        protected VoucherInternetElektronikCustomerNoGuard $elektronikGuard
    ) {
    }

    public function assertAllowed(Product $product, string $targetNumber, ?string $voucherInternetMode): void
    {
        if (! $this->digiGate->isVoucherInternetProduct($product)) {
            return;
        }

        $mode = is_string($voucherInternetMode) && trim($voucherInternetMode) !== ''
            ? $this->digiGate->normalizeMode($voucherInternetMode)
            : null;

        if ($mode === VoucherInternetDigiCategoryGate::MODE_ELEKTRONIK) {
            return;
        }

        if ($mode === null && $this->elektronikGuard->isElektronikStyleTarget($targetNumber)) {
            return;
        }

        $isTembak = $mode === VoucherInternetDigiCategoryGate::MODE_TEMBAK
            || ($mode === null && $this->elektronikGuard->looksLikeIndonesianMobile($targetNumber));

        if (! $isTembak) {
            return;
        }

        $product->loadMissing('provider');
        $productKey = $this->normalizeOperatorKey($product->provider?->name);

        if ($productKey === '' || ! in_array($productKey, self::KNOWN_KEYS, true)) {
            return;
        }

        $phoneKey = $this->detectOperatorKeyFromPhone($targetNumber);

        if ($phoneKey === null) {
            throw ValidationException::withMessages([
                'target_number' => [
                    'Nomor HP tidak dikenali operatornya. Transaksi Tembak Langsung dibatalkan.',
                ],
            ]);
        }

        if ($phoneKey !== $productKey) {
            throw ValidationException::withMessages([
                'target_number' => [
                    'Nomor terdeteksi '.$this->labelForKey($phoneKey)
                    .', tidak sesuai dengan produk '.$this->labelForKey($productKey)
                    .'. Transaksi dibatalkan.',
                ],
            ]);
        }
    }

    /**
     * Same 4-digit 08xx table as mobile/web detectOperatorFromPhone.
     */
    public function detectOperatorKeyFromPhone(string $phoneNo): ?string
    {
        $digits = preg_replace('/\D+/', '', $phoneNo) ?? '';
        if (str_starts_with($digits, '62') && strlen($digits) >= 11) {
            $digits = '0'.substr($digits, 2);
        }
        if (strlen($digits) < 4) {
            return null;
        }

        $prefix = substr($digits, 0, 4);

        return match (true) {
            in_array($prefix, ['0851'], true) => 'byu',
            in_array($prefix, ['0811', '0812', '0813', '0821', '0822', '0852', '0853', '0823'], true) => 'telkomsel',
            in_array($prefix, ['0814', '0815', '0816', '0855', '0856', '0857', '0858'], true) => 'indosat',
            in_array($prefix, ['0817', '0818', '0819', '0859', '0877', '0878'], true) => 'xl',
            in_array($prefix, ['0895', '0896', '0897', '0898', '0899'], true) => 'tri',
            in_array($prefix, ['0831', '0832', '0833', '0838'], true) => 'axis',
            in_array($prefix, ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'], true) => 'smartfren',
            default => null,
        };
    }

    /**
     * Mirror operatorMatch.normalizeOperatorKey + DetectedOperator display names (Tri (3)).
     */
    public function normalizeOperatorKey(?string $name): string
    {
        $raw = preg_replace('/[^a-z0-9]/', '', strtolower((string) $name)) ?? '';
        if ($raw === '') {
            return '';
        }
        if (str_contains($raw, 'telkomsel') || $raw === 'tsel') {
            return 'telkomsel';
        }
        if (str_contains($raw, 'indosat') || $raw === 'im3') {
            return 'indosat';
        }
        if ($raw === 'xl' || str_contains($raw, 'xlaxiata')) {
            return 'xl';
        }
        if ($raw === 'tri' || $raw === 'three' || $raw === '3' || str_starts_with($raw, 'tri')) {
            return 'tri';
        }
        if ($raw === 'axis') {
            return 'axis';
        }
        if (str_contains($raw, 'smart')) {
            return 'smartfren';
        }
        if (str_contains($raw, 'byu')) {
            return 'byu';
        }

        return $raw;
    }

    public function labelForKey(string $key): string
    {
        return match ($key) {
            'telkomsel' => 'Telkomsel',
            'indosat' => 'Indosat',
            'xl' => 'XL',
            'tri' => 'Tri',
            'axis' => 'Axis',
            'smartfren' => 'Smartfren',
            'byu' => 'by.U',
            default => $key,
        };
    }
}
