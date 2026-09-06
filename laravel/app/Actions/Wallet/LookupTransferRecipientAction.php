<?php

namespace App\Actions\Wallet;

use App\Models\User;
use App\Repositories\Contracts\WalletRepositoryInterface;
use Illuminate\Validation\ValidationException;

/**
 * Read-only GurkyPay transfer recipient preview.
 * Reuses WalletRepository::findByWalletNumber (same as TransferWalletAction).
 * Never mutates balance, transactions, or ledger.
 */
class LookupTransferRecipientAction
{
    public function __construct(
        protected WalletRepositoryInterface $walletRepository
    ) {
    }

    /**
     * @return array{wallet_number: string, name: string}|null  null = not found
     *
     * @throws ValidationException when the number resolves to the authenticated user's own wallet
     */
    public function execute(string $walletNumber, User $actor): ?array
    {
        $wallet = $this->walletRepository->findByWalletNumber($walletNumber);
        if (!$wallet) {
            return null;
        }

        // Self-transfer must be distinguishable from "not found" (lookup still resolves the row).
        if ((int) $wallet->user_id === (int) $actor->id) {
            throw ValidationException::withMessages([
                'recipient_wallet_number' => [
                    'Anda tidak dapat melakukan transfer ke rekening GurkyPay sendiri.',
                ],
            ]);
        }

        $wallet->loadMissing('user');

        // Prefer canonical customer-facing number (unified GurkyPay ID).
        $canonical = (string) (
            $wallet->user?->gurky_pay_id
            ?: $wallet->wallet_number
            ?: trim($walletNumber)
        );

        $name = trim((string) ($wallet->user?->name ?? ''));
        if ($name === '') {
            $name = $canonical;
        }

        return [
            'wallet_number' => $canonical,
            'name' => $name,
        ];
    }
}
