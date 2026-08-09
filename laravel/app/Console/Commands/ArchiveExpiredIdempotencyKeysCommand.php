<?php

namespace App\Console\Commands;

use App\Services\Transactions\IdempotencyGuard;
use Illuminate\Console\Command;
use App\Models\Transaction;

/**
 * SRS 14.1 — housekeeping sweep for expired idempotency keys.
 *
 * This command is a housekeeping convenience only: correctness of the 24h TTL does NOT
 * depend on it running on schedule — IdempotencyGuard::claim() already self-heals inline
 * if an expired key is encountered before this sweep reaches it. This command exists to
 * keep the active-key population (and the unique index) small over time.
 *
 * Never deletes a transaction or any financial field — only nulls the idempotency_key
 * column, after writing one audit-log entry per row via IdempotencyGuard::archiveKey().
 */
class ArchiveExpiredIdempotencyKeysCommand extends Command
{
    protected $signature = 'transactions:archive-expired-idempotency-keys {--limit=500}';

    protected $description = 'Archive (null out) idempotency_key on transactions older than the 24h TTL window';

    public function handle(IdempotencyGuard $guard): int
    {
        $limit = (int) $this->option('limit');
        $cutoff = now()->subHours(IdempotencyGuard::TTL_HOURS);
        $archived = 0;

        Transaction::query()
            ->whereNotNull('idempotency_key')
            ->where('created_at', '<', $cutoff)
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->each(function (Transaction $transaction) use ($guard, &$archived) {
                $guard->archiveKey($transaction, 'scheduled_archival');
                $archived++;
            });

        $this->info("Archived idempotency_key on {$archived} expired transaction(s).");

        return self::SUCCESS;
    }
}
