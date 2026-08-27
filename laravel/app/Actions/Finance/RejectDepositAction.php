<?php

namespace App\Actions\Finance;

use App\Models\DepositRequest;
use App\Models\User;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-03 — Finance reject manual deposit (no wallet credit).
 */
class RejectDepositAction
{
    public function execute(DepositRequest $deposit, User $actor, string $reason): DepositRequest
    {
        $reason = trim($reason);
        if ($reason === '') {
            throw ValidationException::withMessages([
                'reason' => ['Alasan penolakan wajib diisi.'],
            ]);
        }

        return DB::transaction(function () use ($deposit, $actor, $reason) {
            $locked = DepositRequest::query()->where('id', $deposit->id)->lockForUpdate()->first();
            if (!$locked) {
                throw ValidationException::withMessages(['id' => ['Deposit request tidak ditemukan.']]);
            }

            if ($locked->status === 'rejected') {
                return $locked->load(['user']);
            }

            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages([
                    'status' => ['Hanya permintaan pending yang dapat ditolak.'],
                ]);
            }

            $locked->status = 'rejected';
            $locked->rejection_reason = $reason;
            $locked->reviewed_by = $actor->id;
            $locked->reviewed_at = now();
            $locked->save();

            FinanceAudit::log($actor, 'FINANCE_DEPOSIT_REJECT', [
                'deposit_request_id' => $locked->id,
                'user_id' => $locked->user_id,
                'amount' => (float) $locked->amount,
                'reason' => $reason,
            ]);

            return $locked->fresh(['user', 'reviewer']);
        });
    }
}
