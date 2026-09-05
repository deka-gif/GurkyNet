<?php

namespace App\Services\Finance;

use App\Models\MidtransTransaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * FR-FIN-01 / FR-FIN-04 — Finance read surfaces over existing wallet & Midtrans data.
 */
class FinanceWalletQueryService
{
    public function listWallets(array $filters = []): LengthAwarePaginator
    {
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $q = trim((string) ($filters['q'] ?? $filters['search'] ?? ''));

        $query = Wallet::query()
            ->with(['user:id,name,email,phone_number,role'])
            ->orderByDesc('balance');

        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('wallet_number', 'like', "%{$q}%")
                    ->orWhere('previous_wallet_number', 'like', "%{$q}%")
                    ->orWhereHas('user', function ($u) use ($q) {
                        $u->where('name', 'like', "%{$q}%")
                            ->orWhere('email', 'like', "%{$q}%")
                            ->orWhere('phone_number', 'like', "%{$q}%")
                            ->orWhere('gurky_pay_id', 'like', "%{$q}%");
                    });
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->paginate($perPage)->through(function (Wallet $wallet) {
            return [
                'id' => $wallet->id,
                'user_id' => $wallet->user_id,
                'wallet_number' => $wallet->wallet_number,
                'previous_wallet_number' => $wallet->previous_wallet_number,
                'gurky_pay_id' => $wallet->user?->gurky_pay_id,
                'balance' => (float) $wallet->balance,
                'status' => $wallet->status,
                'user' => $wallet->user ? [
                    'id' => $wallet->user->id,
                    'name' => $wallet->user->name,
                    'email' => $wallet->user->email,
                    'phone_number' => $wallet->user->phone_number,
                    'role' => $wallet->user->role,
                ] : null,
                'updated_at' => optional($wallet->updated_at)?->toIso8601String(),
            ];
        });
    }

    public function mutationsForUser(int $userId, array $filters = []): LengthAwarePaginator
    {
        $wallet = Wallet::where('user_id', $userId)->firstOrFail();
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));

        $query = WalletMutation::query()
            ->where('wallet_id', $wallet->id)
            ->orderByDesc('id');

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        return $query->paginate($perPage)->through(function (WalletMutation $m) use ($wallet) {
            $history = WalletHistory::query()
                ->where('wallet_id', $wallet->id)
                ->where('reference_id', (string) $m->reference_id)
                ->orderByDesc('id')
                ->first();

            return [
                'id' => $m->id,
                'wallet_id' => $m->wallet_id,
                'user_id' => $wallet->user_id,
                'type' => $m->type,
                'amount' => (float) $m->amount,
                'reference_id' => $m->reference_id,
                'approved_by' => $m->approved_by,
                'description' => $history?->description,
                'history_type' => $history?->type,
                'created_at' => optional($m->created_at)?->toIso8601String(),
                'current_balance' => (float) $wallet->balance,
            ];
        });
    }

    public function automaticDeposits(array $filters = []): LengthAwarePaginator
    {
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $query = MidtransTransaction::query()->orderByDesc('id');

        if (!empty($filters['status'])) {
            $query->where('transaction_status', $filters['status']);
        }
        if (!empty($filters['q'])) {
            $q = trim((string) $filters['q']);
            $query->where('order_id', 'like', "%{$q}%");
        }

        return $query->with('transaction')->paginate($perPage)->through(function (MidtransTransaction $row) {
            $tx = $row->transaction
                ?: \App\Models\Transaction::where('invoice_number', $row->order_id)->first();

            return [
                'id' => $row->id,
                'midtrans_order_id' => $row->order_id,
                'gross_amount' => (float) $row->gross_amount,
                'transaction_status' => $row->transaction_status,
                'payment_type' => $row->payment_type ?? null,
                'transaction_id' => $tx?->id,
                'user_id' => $tx?->user_id,
                'credited' => $tx ? in_array(strtolower((string) $tx->status), ['success', 'sukses'], true) : false,
                'wallet_status' => $tx?->status,
                'created_at' => optional($row->created_at)?->toIso8601String(),
                'updated_at' => optional($row->updated_at)?->toIso8601String(),
            ];
        });
    }
}
