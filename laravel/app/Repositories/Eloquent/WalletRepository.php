<?php

namespace App\Repositories\Eloquent;

use App\Models\User;
use App\Models\Wallet;
use App\Repositories\Contracts\WalletRepositoryInterface;

class WalletRepository implements WalletRepositoryInterface
{
    public function findByUserId(int $userId): ?Wallet
    {
        return Wallet::where('user_id', $userId)->first();
    }

    /**
     * Resolve transfer recipient by customer-facing GurkyPay account number.
     * Looks up: current wallet_number, previous_wallet_number (legacy 1042…),
     * then users.gurky_pay_id (same value post-unify).
     */
    public function findByWalletNumber(string $walletNumber): ?Wallet
    {
        $number = trim($walletNumber);
        if ($number === '') {
            return null;
        }

        $wallet = Wallet::query()->where('wallet_number', $number)->first();
        if ($wallet) {
            return $wallet;
        }

        $wallet = Wallet::query()->where('previous_wallet_number', $number)->first();
        if ($wallet) {
            return $wallet;
        }

        $user = User::query()->where('gurky_pay_id', $number)->first();

        return $user?->wallet;
    }

    public function updateBalance(Wallet $wallet, float $amount): bool
    {
        return $wallet->update([
            'balance' => $wallet->balance + $amount,
        ]);
    }
}
