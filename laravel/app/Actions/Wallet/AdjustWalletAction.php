<?php

namespace App\Actions\Wallet;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use App\Enums\WalletHistoryType;
use App\Enums\TransactionStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdjustWalletAction
{
    public function __construct(
        protected WalletHistoryRepositoryInterface $historyRepository
    ) {}

    /**
     * Manual wallet adjustment (Finance/Owner). Updates wallet, history, and finance ledger.
     *
     * @param  'credit'|'debit'  $direction
     */
    public function execute(
        User $targetUser,
        float $amount,
        string $direction,
        string $reason,
        ?User $actor = null
    ): Transaction {
        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'amount' => ['Nominal penyesuaian harus lebih dari 0.'],
            ]);
        }

        $direction = strtolower($direction);
        if (!in_array($direction, ['credit', 'debit'], true)) {
            throw ValidationException::withMessages([
                'direction' => ['Arah penyesuaian harus credit atau debit.'],
            ]);
        }

        return DB::transaction(function () use ($targetUser, $amount, $direction, $reason, $actor) {
            $wallet = Wallet::where('user_id', $targetUser->id)->lockForUpdate()->first();
            if (!$wallet) {
                throw new \Exception('Wallet target tidak ditemukan.');
            }

            if ($direction === 'debit' && $wallet->balance < $amount) {
                throw ValidationException::withMessages([
                    'amount' => ['Saldo tidak mencukupi untuk penyesuaian debit.'],
                ]);
            }

            if ($direction === 'credit') {
                $wallet->balance += $amount;
            } else {
                $wallet->balance -= $amount;
            }
            $wallet->save();

            $invoiceNumber = 'TRX-ADJ-' . now()->format('YmdHis') . '-' . mt_rand(1000, 9999);
            $actorLabel = $actor?->email ?? 'system';

            $transaction = Transaction::create([
                'user_id' => $targetUser->id,
                'invoice_number' => $invoiceNumber,
                'service_name' => 'Penyesuaian Saldo',
                'target_number' => $wallet->wallet_number,
                'amount' => $amount,
                'admin_fee' => 0,
                'total_payment' => $amount,
                'payment_method' => 'adjustment',
                'status' => TransactionStatus::SUCCESS->value,
                'notes' => "Adjustment ({$direction}) oleh {$actorLabel}: {$reason}",
            ]);

            $this->historyRepository->create([
                'wallet_id' => $wallet->id,
                'amount' => $amount,
                'type' => $direction === 'credit'
                    ? WalletHistoryType::CREDIT->value
                    : WalletHistoryType::DEBIT->value,
                'description' => "Adjustment ({$direction}): {$reason}",
                'reference_id' => $transaction->id,
            ]);

            \App\Models\PaymentHistory::recordFor(
                $transaction,
                'wallet_adjustment',
                'success',
                [
                    'direction' => $direction,
                    'reason' => $reason,
                    'actor' => $actorLabel,
                ]
            );

            if ($direction === 'credit') {
                event(new \App\Events\WalletCredited($wallet, $amount, "Adjustment: {$reason}", $transaction->id));
            } else {
                event(new \App\Events\WalletDebited($wallet, $amount, "Adjustment: {$reason}", $transaction->id));
            }

            event(new \App\Events\TransactionCreated($transaction));
            event(new \App\Events\TransactionSuccess($transaction));

            return $transaction;
        });
    }
}
