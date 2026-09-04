<?php

namespace App\Support\Payments;

use App\Models\Transaction;
use App\Support\Transactions\TransactionStatusMapper;

/**
 * FR-TOPUP-UX-03 — customer-facing payment method labels.
 * Never exposes gateway names (Midtrans) or raw processor enums to customers.
 */
class CustomerFacingPaymentMethod
{
    public const FALLBACK = 'Pembayaran';

    /**
     * Resolve a stable customer-facing label for transaction detail/list.
     */
    public static function labelFor(Transaction $transaction): string
    {
        if (TransactionStatusMapper::isWalletTopUp($transaction)) {
            return self::labelForTopUp($transaction);
        }

        return self::labelForGeneric((string) ($transaction->payment_method ?? ''));
    }

    protected static function labelForTopUp(Transaction $transaction): string
    {
        $fromNotes = self::channelFromTopUpNotes((string) ($transaction->notes ?? ''));
        if ($fromNotes !== null) {
            $mapped = self::mapChannelCode($fromNotes);
            if ($mapped !== null) {
                return $mapped;
            }
        }

        $mt = $transaction->relationLoaded('midtransTransaction')
            ? $transaction->midtransTransaction
            : $transaction->midtransTransaction()->first();

        if ($mt) {
            $fromMt = self::labelFromMidtransRow(
                (string) ($mt->payment_type ?? ''),
                is_array($mt->raw_notification) ? $mt->raw_notification : []
            );
            if ($fromMt !== null) {
                return $fromMt;
            }
        }

        $generic = self::labelForGeneric((string) ($transaction->payment_method ?? ''));
        if (strtolower($generic) === 'midtrans' || $generic === self::FALLBACK) {
            return self::FALLBACK;
        }

        return $generic;
    }

    /**
     * Notes written at Top Up create: "Top up saldo via Midtrans (va/bca_va)".
     */
    protected static function channelFromTopUpNotes(string $notes): ?string
    {
        if ($notes === '') {
            return null;
        }

        if (preg_match('/via\s+Midtrans\s*\(\s*([^\/\)]+)\s*\/\s*([^\)\s]+)\s*\)/i', $notes, $m) === 1) {
            return strtolower(trim($m[2]));
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $raw
     */
    protected static function labelFromMidtransRow(string $paymentType, array $raw): ?string
    {
        $type = strtolower(trim($paymentType));
        if ($type === '') {
            return null;
        }

        // Catalog codes stored at Snap create (before Core API overwrites).
        $fromCatalog = self::mapChannelCode($type);
        if ($fromCatalog !== null) {
            return $fromCatalog;
        }

        $bank = self::extractBank($raw);
        $store = self::extractStore($raw);

        return match ($type) {
            'qris', 'other_qris' => 'QRIS',
            'gopay' => 'GoPay',
            'shopeepay' => 'ShopeePay',
            'dana' => 'DANA',
            'ovo' => 'OVO',
            'linkaja' => 'LinkAja',
            'akulaku' => 'Akulaku',
            'kredivo' => 'Kredivo',
            'credit_card', 'card' => 'Kartu Kredit/Debit',
            'echannel' => 'Virtual Account Mandiri',
            'bca_klikpay' => 'BCA KlikPay',
            'cimb_clicks' => 'CIMB Clicks',
            'danamon_online' => 'Danamon Online Banking',
            'bank_transfer' => self::virtualAccountLabel($bank) ?? 'Virtual Account',
            'cstore' => self::retailLabel($store) ?? 'Gerai Retail',
            default => self::mapChannelCode($type),
        };
    }

    /**
     * @param  array<string, mixed>  $raw
     */
    protected static function extractBank(array $raw): ?string
    {
        $bank = $raw['bank'] ?? null;
        if (is_string($bank) && trim($bank) !== '') {
            return strtolower(trim($bank));
        }

        $vaNumbers = $raw['va_numbers'] ?? null;
        if (is_array($vaNumbers) && isset($vaNumbers[0]) && is_array($vaNumbers[0])) {
            $nested = $vaNumbers[0]['bank'] ?? null;
            if (is_string($nested) && trim($nested) !== '') {
                return strtolower(trim($nested));
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $raw
     */
    protected static function extractStore(array $raw): ?string
    {
        $store = $raw['store'] ?? null;
        if (is_string($store) && trim($store) !== '') {
            return strtolower(trim($store));
        }

        return null;
    }

    protected static function virtualAccountLabel(?string $bank): ?string
    {
        if ($bank === null || $bank === '') {
            return null;
        }

        return match ($bank) {
            'bca' => 'Virtual Account BCA',
            'bri' => 'Virtual Account BRI',
            'bni' => 'Virtual Account BNI',
            'mandiri', 'echannel' => 'Virtual Account Mandiri',
            'permata' => 'Virtual Account Permata',
            'cimb' => 'Virtual Account CIMB',
            'other' => 'Virtual Account',
            default => 'Virtual Account '.strtoupper($bank),
        };
    }

    protected static function retailLabel(?string $store): ?string
    {
        if ($store === null || $store === '') {
            return null;
        }

        return match ($store) {
            'indomaret' => 'Indomaret',
            'alfamart' => 'Alfamart',
            default => ucfirst($store),
        };
    }

    protected static function mapChannelCode(string $code): ?string
    {
        $key = strtolower(trim($code));

        return match ($key) {
            'qris', 'other_qris' => 'QRIS',
            'bca_va', 'bca' => 'Virtual Account BCA',
            'bri_va', 'bri' => 'Virtual Account BRI',
            'bni_va', 'bni' => 'Virtual Account BNI',
            'echannel', 'mandiri', 'mandiri_va' => 'Virtual Account Mandiri',
            'permata_va', 'permata' => 'Virtual Account Permata',
            'alfamart' => 'Alfamart',
            'indomaret' => 'Indomaret',
            'gopay' => 'GoPay',
            'shopeepay' => 'ShopeePay',
            'dana' => 'DANA',
            'ovo' => 'OVO',
            'linkaja' => 'LinkAja',
            'va' => 'Virtual Account',
            'retail' => 'Gerai Retail',
            default => null,
        };
    }

    protected static function labelForGeneric(string $paymentMethod): string
    {
        $key = strtolower(trim($paymentMethod));
        if ($key === '' || $key === 'midtrans') {
            return self::FALLBACK;
        }

        return match ($key) {
            'wallet' => 'Saldo Dompet',
            'manual_transfer' => 'Transfer Manual',
            'dummy_gateway' => self::FALLBACK,
            'loyalty_redeem' => 'Poin Loyalitas',
            'partner_wallet' => 'Saldo Partner',
            'qris' => 'QRIS',
            default => self::mapChannelCode($key) ?? (preg_match('/^[a-z0-9_\-]+$/i', $key) === 1
                ? self::FALLBACK
                : $paymentMethod),
        };
    }
}
