<?php

namespace App\Actions\Finance;

use App\Enums\TransactionStatus;
use App\Models\DepositRequest;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Wallet\WalletLedgerService;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-03 — Finance approve manual deposit → credit wallet once.
 */
class ApproveDepositAction
{
    public function __construct(protected WalletLedgerService $ledgerService) {}

    public function execute(DepositRequest $deposit, User $actor): DepositRequest
    {
        return DB::transaction(function () use ($deposit, $actor) {
            $locked = DepositRequest::query()->where('id', $deposit->id)->lockForUpdate()->first();
            if (!$locked) {
                throw ValidationException::withMessages(['id' => ['Deposit request tidak ditemukan.']]);
            }

            if ($locked->status === 'approved') {
                return $locked->load(['user', 'transaction']);
            }

            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages([
                    'status' => ['Hanya permintaan pending yang dapat disetujui.'],
                ]);
            }

            $wallet = Wallet::where('user_id', $locked->user_id)->lockForUpdate()->first();
            if (!$wallet) {
                throw new \RuntimeException('Wallet pengguna tidak ditemukan.');
            }

            $amount = (float) $locked->amount;
            $wallet->balance = (float) $wallet->balance + $amount;
            $wallet->save();

            $invoice = 'TRX-DEP-M-'.now()->format('YmdHis').'-'.mt_rand(1000, 9999);
            $transaction = Transaction::create([
                'user_id' => $locked->user_id,
                'invoice_number' => $invoice,
                'service_name' => 'Deposit Manual',
                'target_number' => $wallet->wallet_number,
                'amount' => $amount,
                'admin_fee' => 0,
                'total_payment' => $amount,
                'payment_method' => 'manual_transfer',
                'status' => TransactionStatus::SUCCESS->value,
                'notes' => 'Deposit manual disetujui Finance #'.$locked->id,
            ]);

            $this->ledgerService->record(
                $wallet,
                WalletMutation::TYPE_TOPUP,
                $amount,
                'credit',
                'Deposit manual disetujui #'.$locked->id,
                $transaction->id,
                $actor->id
            );

            \App\Models\PaymentHistory::recordFor(
                $transaction,
                'manual_deposit',
                'success',
                ['deposit_request_id' => $locked->id]
            );

            $locked->status = 'approved';
            $locked->reviewed_by = $actor->id;
            $locked->reviewed_at = now();
            $locked->transaction_id = $transaction->id;
            $locked->save();

            FinanceAudit::log($actor, 'FINANCE_DEPOSIT_APPROVE', [
                'deposit_request_id' => $locked->id,
                'transaction_id' => $transaction->id,
                'user_id' => $locked->user_id,
                'amount' => $amount,
                'new_balance' => (float) $wallet->balance,
            ]);

            event(new \App\Events\WalletCredited($wallet, $amount, 'Deposit manual', $transaction->id));

            return $locked->fresh(['user', 'transaction', 'reviewer']);
        });
    }
}
