<?php

namespace App\Repositories\Contracts;

use App\Models\Wallet;

interface WalletRepositoryInterface
{
    public function findByUserId(int $userId): ?Wallet;
    public function findByWalletNumber(string $walletNumber): ?Wallet;
    public function updateBalance(Wallet $wallet, float $amount): bool;
}
