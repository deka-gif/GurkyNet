<?php

namespace App\Services\Wallet;

/**
 * P0 — resolve wallet money-move admin fees from server config only.
 * Client-supplied admin_fee must never reach these methods.
 */
final class WalletAdminFeeResolver
{
    public static function topUpFee(): float
    {
        return self::normalize((float) config('wallet.topup_fee', 0.0));
    }

    public static function transferFee(): float
    {
        return self::normalize((float) config('wallet.transfer_fee', 0.0));
    }

    public static function withdrawFee(): float
    {
        return self::normalize((float) config('wallet.withdraw_fee', 0.0));
    }

    protected static function normalize(float $fee): float
    {
        if (! is_finite($fee) || $fee < 0) {
            throw new \InvalidArgumentException('Wallet admin fee configuration is invalid.');
        }

        return round($fee, 2);
    }
}
