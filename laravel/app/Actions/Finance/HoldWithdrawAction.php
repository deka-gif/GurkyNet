<?php

namespace App\Actions\Finance;

use App\Models\User;
use App\Models\WithdrawRequest;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-05 — hold for further verification (keep existing wallet hold).
 */
class HoldWithdrawAction
{
    public function execute(WithdrawRequest $request, User $actor, ?string $notes = null): WithdrawRequest
    {
        return DB::transaction(function () use ($request, $actor, $notes) {
            $locked = WithdrawRequest::query()->where('id', $request->id)->lockForUpdate()->first();
            if (!$locked) {
                throw ValidationException::withMessages(['id' => ['Withdraw request tidak ditemukan.']]);
            }

            if ($locked->status === 'on_hold') {
                if ($notes) {
                    $locked->notes = $notes;
                    $locked->save();
                }

                return $locked->load(['user', 'transaction']);
            }

            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages([
                    'status' => ['Hanya permintaan pending yang dapat di-hold.'],
                ]);
            }

            if (!$locked->isHoldQueue()) {
                throw ValidationException::withMessages([
                    'workflow' => ['Permintaan legacy tidak mendukung hold antrean.'],
                ]);
            }

            $locked->status = 'on_hold';
            $locked->reviewed_by = $actor->id;
            $locked->reviewed_at = now();
            if ($notes) {
                $locked->notes = $notes;
            }
            $locked->save();

            FinanceAudit::log($actor, 'FINANCE_WITHDRAW_HOLD', [
                'withdraw_request_id' => $locked->id,
                'user_id' => $locked->user_id,
                'notes' => $notes,
            ]);

            return $locked->fresh(['user', 'transaction', 'reviewer']);
        });
    }
}
