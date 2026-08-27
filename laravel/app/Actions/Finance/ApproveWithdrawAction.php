<?php

namespace App\Actions\Finance;

use App\Enums\TransactionStatus;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use App\Services\Wallet\WalletLedgerService;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-05 — approve held withdraw: finalize (no second balance debit).
 */
class ApproveWithdrawAction
{
    public function __construct(protected WalletLedgerService $ledgerService) {}

    public function execute(WithdrawRequest $request, User $actor, ?string $notes = null): WithdrawRequest
    {
        return DB::transaction(function () use ($request, $actor, $notes) {
            $locked = WithdrawRequest::query()->where('id', $request->id)->lockForUpdate()->first();
            if (!$locked) {
                throw ValidationException::withMessages(['id' => ['Withdraw request tidak ditemukan.']]);
            }

            if ($locked->status === 'approved') {
                return $locked->load(['user', 'transaction']);
            }

            if (!$locked->isHoldQueue()) {
                throw ValidationException::withMessages([
                    'workflow' => ['Permintaan legacy debit-langsung tidak dapat diproses lewat antrean hold.'],
                ]);
            }

            if (!in_array($locked->status, ['pending', 'on_hold'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Status permintaan tidak memungkinkan persetujuan.'],
                ]);
            }

            $wallet = Wallet::where('user_id', $locked->user_id)->lockForUpdate()->first();
            if (!$wallet) {
                throw new \RuntimeException('Wallet tidak ditemukan.');
            }

            $total = $locked->totalDebit();
            $tx = $locked->transaction_id
                ? \App\Models\Transaction::where('id', $locked->transaction_id)->lockForUpdate()->first()
                : null;

            // Balance already reduced on hold — record permanent withdraw mutation only.
            $this->ledgerService->record(
                $wallet,
                WalletMutation::TYPE_WITHDRAW,
                $total,
                'debit',
                'Withdraw disetujui Finance #'.$locked->id,
                $tx?->id ?? $locked->id,
                $actor->id
            );

            if ($tx) {
                $tx->status = TransactionStatus::SUCCESS->value;
                $tx->notes = trim(($tx->notes ? $tx->notes.' | ' : '').'Disetujui Finance');
                $tx->save();
                \App\Models\PaymentHistory::recordFor($tx, 'wallet_withdraw', 'success', [
                    'withdraw_request_id' => $locked->id,
                ]);
            }

            $locked->status = 'approved';
            $locked->reviewed_by = $actor->id;
            $locked->reviewed_at = now();
            if ($notes) {
                $locked->notes = $notes;
            }
            $locked->save();

            FinanceAudit::log($actor, 'FINANCE_WITHDRAW_APPROVE', [
                'withdraw_request_id' => $locked->id,
                'transaction_id' => $locked->transaction_id,
                'user_id' => $locked->user_id,
                'amount' => (float) $locked->amount,
                'total' => $total,
                'balance_unchanged' => true,
            ]);

            return $locked->fresh(['user', 'transaction', 'reviewer']);
        });
    }
}
