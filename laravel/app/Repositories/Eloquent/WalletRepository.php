<?php

namespace App\Repositories\Eloquent;

use App\Models\Wallet;
use App\Repositories\Contracts\WalletRepositoryInterface;

class WalletRepository implements WalletRepositoryInterface
{
    public function findByUserId(int $userId): ?Wallet
    {
        return Wallet::where('user_id', $userId)->first();
    }

    public function findByWalletNumber(string $walletNumber): ?Wallet
    {
        return Wallet::where('wallet_number', $walletNumber)->first();
    }

    public function updateBalance(Wallet $wallet, float $amount): bool
    {
        return $wallet->update([
            'balance' => $wallet->balance + $amount,
        ]);
    }
}
