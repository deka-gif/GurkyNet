<?php

namespace App\Actions\Wallet;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Models\WalletMutation;
use App\Enums\TransactionStatus;
use App\Services\Wallet\WalletLedgerService;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdjustWalletAction
{
    public function __construct(
        protected WalletLedgerService $ledgerService
    ) {}

    /**
     * Manual wallet adjustment (Finance/Owner). Updates wallet, ledger (mutation+history), and finance ledger.
     * SRS 14.2 — type=adjustment. Optional idempotency_key stored as transactions mirror only.
     *
     * @param  'credit'|'debit'  $direction
     */
    public function execute(
        User $targetUser,
        float $amount,
        string $direction,
        string $reason,
        ?User $actor = null,
        ?string $idempotencyKey = null
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

        return DB::transaction(function () use ($targetUser, $amount, $direction, $reason, $actor, $idempotencyKey) {
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
                'idempotency_key' => $idempotencyKey,
            ]);

            $desc = "Adjustment ({$direction}): {$reason}";
            $this->ledgerService->record(
                $wallet,
                WalletMutation::TYPE_ADJUSTMENT,
                $amount,
                $direction,
                $desc,
                $transaction->id,
                $actor?->id
            );

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

            // FR-FIN-02 — audit trail via existing ActivityLog
            FinanceAudit::log($actor, 'FINANCE_WALLET_ADJUST', [
                'transaction_id' => $transaction->id,
                'user_id' => $targetUser->id,
                'direction' => $direction,
                'amount' => $amount,
                'reason' => $reason,
                'new_balance' => (float) $wallet->balance,
            ]);

            return $transaction;
        });
    }
}
