<?php

namespace App\Services\Transactions;

use App\Models\ActivityLog;
use App\Models\Transaction;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;

/**
 * SRS 14.1 — server-side idempotency for balance-mutating actions (purchase, top up,
 * transfer, withdraw). Reuses the existing `transactions` table (no parallel
 * `idempotency_requests` table) per Sprint 3 Final Execution Plan — Revised, §5.
 *
 * Design:
 *  - `idempotency_key` + UNIQUE(user_id, idempotency_key) on `transactions` is the safety net.
 *  - The 24h TTL is enforced in real time at lookup (findActive), not by a scheduler.
 *  - Because MySQL cannot express a "unique only while active" index, expired keys are
 *    freed by nulling the column (never deleting the transaction row) — either by the
 *    scheduled archival command (housekeeping) or on-demand right here if a request
 *    collides with a not-yet-archived expired row (correctness never depends on the
 *    scheduler having already run).
 */
class IdempotencyGuard
{
    public const TTL_HOURS = 24;

    /**
     * Find an active (non-expired) transaction previously created with this key.
     */
    public function findActive(int $userId, ?string $key): ?Transaction
    {
        if ($key === null || $key === '') {
            return null;
        }

        return Transaction::where('user_id', $userId)
            ->where('idempotency_key', $key)
            ->where('created_at', '>=', now()->subHours(self::TTL_HOURS))
            ->first();
    }

    /**
     * Claim an idempotency key by attempting the given insert closure.
     *
     * Returns the transaction to use and whether it was newly created (true) or an
     * existing/replayed transaction (false). Callers MUST NOT perform any wallet debit,
     * provider dispatch, or payment checkout creation when `is_new` is false.
     *
     * @param  Closure(): Transaction  $insert  Creates+returns the transaction row; MUST be
     *                                          the first write of the surrounding DB transaction
     *                                          (i.e. no wallet mutation must have happened yet)
     *                                          so a caught duplicate-key error leaves no side effect.
     * @return array{transaction: Transaction, is_new: bool}
     */
    public function claim(int $userId, ?string $key, Closure $insert): array
    {
        if ($key === null || $key === '') {
            return ['transaction' => $insert(), 'is_new' => true];
        }

        $existing = $this->findActive($userId, $key);
        if ($existing) {
            Log::info('IDEMPOTENCY — replay within TTL, returning existing transaction', [
                'user_id' => $userId,
                'transaction_id' => $existing->id,
                'idempotency_key' => $key,
            ]);

            return ['transaction' => $existing, 'is_new' => false];
        }

        try {
            return ['transaction' => $insert(), 'is_new' => true];
        } catch (QueryException $e) {
            if (!$this->isDuplicateKeyViolation($e)) {
                throw $e;
            }

            $conflict = Transaction::where('user_id', $userId)
                ->where('idempotency_key', $key)
                ->first();

            if ($conflict && $conflict->created_at !== null && $conflict->created_at->lt(now()->subHours(self::TTL_HOURS))) {
                // Expired row still occupying the unique slot (scheduler has not archived it
                // yet) — self-heal inline so correctness never depends on the hourly sweep.
                $this->archiveKey($conflict, 'on_demand_self_heal');

                return ['transaction' => $insert(), 'is_new' => true];
            }

            if ($conflict) {
                // Genuine simultaneous race (double-click / two tabs / two devices):
                // the other request won the insert — resolve to its transaction, no 500,
                // no second debit.
                Log::info('IDEMPOTENCY — concurrent insert lost race, returning winning transaction', [
                    'user_id' => $userId,
                    'transaction_id' => $conflict->id,
                    'idempotency_key' => $key,
                ]);

                return ['transaction' => $conflict, 'is_new' => false];
            }

            // Unique violation but no matching row found (should not normally happen) —
            // do not swallow silently, surface the original error.
            throw $e;
        }
    }

    /**
     * Null out the active idempotency_key on a transaction, preserving a forensic trace
     * of the original value in the existing audit-log mechanism. The financial record
     * itself (amount, status, history) is never touched.
     */
    public function archiveKey(Transaction $transaction, string $reason): void
    {
        if (!$transaction->idempotency_key) {
            return;
        }

        ActivityLog::create([
            'user_id' => $transaction->user_id,
            'activity' => 'IDEMPOTENCY_KEY_ARCHIVED',
            'payload' => [
                'transaction_id' => $transaction->id,
                'idempotency_key' => $transaction->idempotency_key,
                'reason' => $reason,
                'created_at' => optional($transaction->created_at)->toIso8601String(),
            ],
        ]);

        $transaction->forceFill(['idempotency_key' => null])->save();
    }

    protected function isDuplicateKeyViolation(QueryException $e): bool
    {
        // MySQL: SQLSTATE 23000, driver error code 1062 (Duplicate entry).
        return (string) $e->getCode() === '23000' && (int) ($e->errorInfo[1] ?? 0) === 1062;
    }
}
