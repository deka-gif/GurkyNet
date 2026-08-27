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
 * FR-FIN-05 — reject held withdraw → unhold (credit back).
 */
class RejectWithdrawAction
{
    public function __construct(protected WalletLedgerService $ledgerService) {}

    public function execute(WithdrawRequest $request, User $actor, string $reason): WithdrawRequest
    {
        $reason = trim($reason);
        if ($reason === '') {
            throw ValidationException::withMessages([
                'reason' => ['Alasan penolakan wajib diisi.'],
            ]);
        }

        return DB::transaction(function () use ($request, $actor, $reason) {
            $locked = WithdrawRequest::query()->where('id', $request->id)->lockForUpdate()->first();
            if (!$locked) {
                throw ValidationException::withMessages(['id' => ['Withdraw request tidak ditemukan.']]);
            }

            if ($locked->status === 'rejected') {
                return $locked->load(['user', 'transaction']);
            }

            if (!$locked->isHoldQueue()) {
                throw ValidationException::withMessages([
                    'workflow' => ['Permintaan legacy tidak dapat di-unhold lewat antrean baru.'],
                ]);
            }

            if (!in_array($locked->status, ['pending', 'on_hold'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Status permintaan tidak memungkinkan penolakan.'],
                ]);
            }

            $wallet = Wallet::where('user_id', $locked->user_id)->lockForUpdate()->first();
            if (!$wallet) {
                throw new \RuntimeException('Wallet tidak ditemukan.');
            }

            $total = $locked->totalDebit();
            $wallet->balance = (float) $wallet->balance + $total;
            $wallet->save();

            $tx = $locked->transaction_id
                ? \App\Models\Transaction::where('id', $locked->transaction_id)->lockForUpdate()->first()
                : null;

            $this->ledgerService->record(
                $wallet,
                WalletMutation::TYPE_REFUND,
                $total,
                'credit',
                'Unhold withdraw ditolak Finance #'.$locked->id.': '.$reason,
                $tx?->id ?? $locked->id,
                $actor->id
            );

            if ($tx) {
                $tx->status = TransactionStatus::CANCELED->value;
                $tx->notes = trim(($tx->notes ? $tx->notes.' | ' : '').'Ditolak Finance: '.$reason);
                $tx->save();
                \App\Models\PaymentHistory::recordFor($tx, 'wallet_withdraw', 'rejected', [
                    'withdraw_request_id' => $locked->id,
                    'reason' => $reason,
                ]);
            }

            $locked->status = 'rejected';
            $locked->rejection_reason = $reason;
            $locked->reviewed_by = $actor->id;
            $locked->reviewed_at = now();
            $locked->save();

            FinanceAudit::log($actor, 'FINANCE_WITHDRAW_REJECT', [
                'withdraw_request_id' => $locked->id,
                'transaction_id' => $locked->transaction_id,
                'user_id' => $locked->user_id,
                'amount' => $total,
                'reason' => $reason,
                'new_balance' => (float) $wallet->balance,
            ]);

            event(new \App\Events\WalletCredited($wallet, $total, 'Unhold withdraw', $tx?->id));

            return $locked->fresh(['user', 'transaction', 'reviewer']);
        });
    }
}
