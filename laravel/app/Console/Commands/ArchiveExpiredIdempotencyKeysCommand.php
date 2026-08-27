<?php

namespace App\Console\Commands;

use App\Services\Transactions\IdempotencyGuard;
use App\Services\Transactions\IdempotencyRequestService;
use Illuminate\Console\Command;
use App\Models\Transaction;

/**
 * SRS 14.1 — housekeeping sweep for expired idempotency keys.
 *
 * Archives both:
 *  - transactions.idempotency_key (legacy / claim safety net)
 *  - idempotency_requests rows (source of truth)
 *
 * This command is a housekeeping convenience only: correctness of the 24h TTL does NOT
 * depend on it running on schedule — claim paths already self-heal inline if an expired
 * key is encountered before this sweep reaches it.
 *
 * Never deletes a transaction or any financial field — only nulls the idempotency_key
 * column / marks idempotency_requests archived.
 */
class ArchiveExpiredIdempotencyKeysCommand extends Command
{
    protected $signature = 'transactions:archive-expired-idempotency-keys {--limit=500}';

    protected $description = 'Archive expired transaction idempotency_key and idempotency_requests (24h TTL)';

    public function handle(IdempotencyGuard $guard, IdempotencyRequestService $requestService): int
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

        // SRS 14.1 SoT — archive expired idempotency_requests (not hard delete).
        $archivedRequests = $requestService->archiveExpired();

        $this->info("Archived idempotency_key on {$archived} expired transaction(s).");
        $this->info("Archived {$archivedRequests} expired idempotency_requests row(s).");

        return self::SUCCESS;
    }
}
