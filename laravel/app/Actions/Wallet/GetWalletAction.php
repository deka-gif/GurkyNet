<?php

namespace App\Actions\Wallet;

use App\Models\Wallet;
use App\Repositories\Contracts\WalletRepositoryInterface;

class GetWalletAction
{
    protected WalletRepositoryInterface $walletRepository;

    public function __construct(WalletRepositoryInterface $walletRepository)
    {
        $this->walletRepository = $walletRepository;
    }

    public function execute(int $userId): ?Wallet
    {
        return $this->walletRepository->findByUserId($userId);
    }
}
