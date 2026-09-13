<?php

namespace App\Services\Transactions;

use App\Enums\TransactionStatus;
use App\Jobs\WatchPendingTransactionJob;
use App\Models\DigiflazzTransaction;
use App\Models\PaymentHistory;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\Transaction;
use App\Services\NotificationService;
use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\WalletRefundService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Soft poll ladder + extended monitoring for in-flight PPOB purchases (all categories).
 *
 * Owner 2026-09-13 (post ShopeePay late-success incident):
 * - NEVER auto-refund solely because soft ladder / wall-clock elapsed while Digi is Pending.
 * - Refund ONLY on explicit provider failure (Digi official Status=Gagal / refundable RC,
 *   or non-Digi adapter status failed/error).
 * - After soft ladder: keep Pending, poll less often until manual_review_after_seconds,
 *   then escalate to Finance/Ops alert — still no auto-refund.
 *
 * Digiflazz Cek Status: ≥60s between probes for the same transaction.
 */
class TransactionTimeoutService
{
    /** Ladder index used for post-soft extended monitoring jobs. */
    public const EXTENDED_CHECK_INDEX = 1000;

    public function __construct(
        protected ProductProviderRegistry $registry,
        protected WalletRefundService $refundService,
        protected NotificationService $notificationService,
        protected TransactionSuccessTransitionService $successTransition,
    ) {}

    public function maxSeconds(): int
    {
        return max(1, (int) config('ppob.timeout.max_seconds', 180));
    }

    public function extendedCheckIntervalSeconds(): int
    {
        return max($this->minCheckIntervalSeconds(), (int) config('ppob.timeout.extended_check_interval_seconds', 900));
    }

    public function manualReviewAfterSeconds(): int
    {
        return max($this->maxSeconds() + 60, (int) config('ppob.timeout.manual_review_after_seconds', 21600));
    }

    /**
     * Minimum seconds between status checks for the same transaction (Digiflazz: ≥ 60).
     */
    public function minCheckIntervalSeconds(): int
    {
        return max(60, (int) config('ppob.timeout.min_check_interval_seconds', 60));
    }

    /**
     * @return list<int>
     */
    public function checkOffsets(): array
    {
        $min = $this->minCheckIntervalSeconds();
        $offsets = config('ppob.timeout.check_at_seconds', [60, 120, 180]);
        if (!is_array($offsets) || $offsets === []) {
            $offsets = [$min, $min * 2, $min * 3];
        }

        $offsets = array_values(array_unique(array_map('intval', $offsets)));
        sort($offsets);

        $normalized = [];
        foreach ($offsets as $offset) {
            if ($offset < 1) {
                continue;
            }
            if ($normalized === []) {
                $normalized[] = max($offset, $min);
                continue;
            }
            $previous = $normalized[array_key_last($normalized)];
            $normalized[] = max($offset, $previous + $min);
        }

        return $normalized !== [] ? $normalized : [$min];
    }

    /**
     * Stamp timeout deadline and schedule the first async status check.
     */
    public function arm(Transaction $transaction): Transaction
    {
        $max = $this->maxSeconds();
        $timeoutAt = ($transaction->created_at ?? now())->copy()->addSeconds($max);

        $transaction->forceFill([
            'timeout_at' => $timeoutAt,
        ])->save();

        $this->scheduleNextCheck($transaction->fresh() ?? $transaction, 0);

        Log::info('TX TIMEOUT — armed', [
            'transaction_id' => $transaction->id,
            'invoice' => $transaction->invoice_number,
            'timeout_at' => optional($timeoutAt)->toIso8601String(),
            'max_seconds' => $max,
            'checks' => $this->checkOffsets(),
        ]);

        return $transaction->fresh() ?? $transaction;
    }

    public function scheduleNextCheck(Transaction $transaction, int $checkIndex): void
    {
        $offsets = $this->checkOffsets();
        if ($checkIndex < 0 || $checkIndex >= count($offsets)) {
            return;
        }

        $anchor = $transaction->created_at ?? now();
        $targetAt = $anchor->copy()->addSeconds($offsets[$checkIndex]);
        $delay = max(0, $targetAt->getTimestamp() - now()->getTimestamp());

        WatchPendingTransactionJob::dispatch($transaction->id, $checkIndex)
            ->delay(now()->addSeconds($delay));

        Log::info('TX TIMEOUT — scheduled check', [
            'transaction_id' => $transaction->id,
            'check_index' => $checkIndex,
            'offset_seconds' => $offsets[$checkIndex],
            'delay_seconds' => $delay,
            'provider_ref' => $transaction->provider_ref,
        ]);
    }

    /**
     * After provider accepts an order (status waiting/processing), schedule the first status poll.
     * Digiflazz Cek Status forbids re-calling the same tx under 60s — delay is clamped to min interval.
     * Uses the first ladder index so settlement still follows the same handler.
     */
    public function scheduleEarlyStatusPoll(Transaction $transaction, ?int $delaySeconds = null): void
    {
        $min = $this->minCheckIntervalSeconds();
        $delaySeconds = max($min, $delaySeconds ?? $min);

        WatchPendingTransactionJob::dispatch($transaction->id, 0)
            ->delay(now()->addSeconds($delaySeconds));

        Log::info('TX TIMEOUT — early CHECK STATUS scheduled', [
            'transaction_id' => $transaction->id,
            'delay_seconds' => $delaySeconds,
            'min_interval_seconds' => $min,
            'provider_ref' => $transaction->provider_ref,
            'fulfillment_provider_code' => $transaction->fulfillment_provider_code,
        ]);
    }

    /**
     * Run one timeout ladder / extended monitoring step.
     * Soft ladder end while still Pending → extended polls (no refund).
     * Explicit provider Gagal → refund. Hard backstop → manual review (no refund).
     */
    public function handleCheck(int $transactionId, int $checkIndex): void
    {
        $transaction = Transaction::with(['items', 'user', 'digiflazzTransaction'])->find($transactionId);
        if (!$transaction) {
            Log::warning('TX TIMEOUT — transaction missing', ['transaction_id' => $transactionId]);

            return;
        }

        if (!$this->isInFlight($transaction)) {
            Log::info('TX TIMEOUT — already terminal', [
                'transaction_id' => $transactionId,
                'status' => $transaction->status,
            ]);

            return;
        }

        if (($transaction->provider_last_status ?? '') === 'manual_review') {
            Log::info('TX TIMEOUT — already flagged manual_review', [
                'transaction_id' => $transactionId,
            ]);

            return;
        }

        $offsets = $this->checkOffsets();
        $elapsed = max(0, now()->getTimestamp() - ($transaction->created_at?->getTimestamp() ?? now()->getTimestamp()));
        $inExtended = $checkIndex >= self::EXTENDED_CHECK_INDEX;
        $softLadderDone = $inExtended
            || $checkIndex >= count($offsets) - 1
            || $elapsed >= $this->maxSeconds();

        Log::info('TX TIMEOUT — status check starting', [
            'transaction_id' => $transaction->id,
            'check_index' => $checkIndex,
            'elapsed_seconds' => $elapsed,
            'soft_ladder_done' => $softLadderDone,
            'extended' => $inExtended,
            'provider_code' => $transaction->fulfillment_provider_code,
            'provider_last_status' => $transaction->provider_last_status,
        ]);

        $probe = $this->probeProvider($transaction);

        // Skipped Digiflazz probe (min 60s interval) must not advance settlement.
        if ($probe && $probe->reason === 'min_interval_skip') {
            $transaction->forceFill([
                'provider_last_status' => 'pending',
            ])->save();

            $delay = $inExtended ? $this->extendedCheckIntervalSeconds() : $this->minCheckIntervalSeconds();
            if ($transaction->provider_checked_at) {
                $elapsedSinceCheck = max(0, now()->getTimestamp() - $transaction->provider_checked_at->getTimestamp());
                $delay = max(1, $delay - $elapsedSinceCheck);
            }

            WatchPendingTransactionJob::dispatch($transaction->id, $checkIndex)
                ->delay(now()->addSeconds($delay));

            Log::info('TX TIMEOUT — rescheduled after min-interval skip', [
                'transaction_id' => $transaction->id,
                'check_index' => $checkIndex,
                'delay_seconds' => $delay,
            ]);

            return;
        }

        $transaction->forceFill([
            'provider_checked_at' => now(),
            'provider_last_status' => $probe?->status ?? 'no_provider_order',
        ])->save();

        if ($probe && $probe->ok && $probe->status === 'success') {
            $this->applySuccess($transaction, $probe);

            return;
        }

        if ($this->isExplicitProviderFailure($transaction, $probe)) {
            $this->applyFailure(
                $transaction,
                'Transaksi gagal. Saldo telah dikembalikan.',
                'provider_status_failed',
                'transaction_failed'
            );

            return;
        }

        // Still Pending / silent / non-final — never auto-refund here.
        if ($elapsed >= $this->manualReviewAfterSeconds()) {
            $this->markManualReview($transaction, $elapsed, $probe);

            return;
        }

        if (! $softLadderDone) {
            $this->scheduleNextCheck($transaction, $checkIndex + 1);

            return;
        }

        $this->scheduleExtendedCheck($transaction, $elapsed);
    }

    /**
     * Catch-all for queue restarts / missed delayed jobs.
     * Re-queues extended monitoring — never forces timeout refund.
     */
    public function reconcileOverdue(int $limit = 100): int
    {
        $candidates = Transaction::query()
            ->whereIn('status', TransactionStatusMapper::reconcileOpenStatuses())
            ->where(function ($q) {
                $q->whereNotNull('timeout_at')->where('timeout_at', '<=', now())
                    ->orWhere(function ($q2) {
                        $q2->whereNull('timeout_at')
                            ->where('created_at', '<=', now()->subSeconds($this->maxSeconds()));
                    });
            })
            ->where(function ($q) {
                $q->whereNull('provider_last_status')
                    ->orWhere('provider_last_status', '!=', 'manual_review');
            })
            ->orderBy('id')
            ->limit($limit * 2)
            ->get(['id', 'payment_method', 'service_name']);

        $ids = $candidates
            ->reject(fn (Transaction $t) => TransactionStatusMapper::isWalletTopUp($t))
            ->take($limit)
            ->pluck('id');

        foreach ($ids as $id) {
            WatchPendingTransactionJob::dispatch((int) $id, self::EXTENDED_CHECK_INDEX);
        }

        return $ids->count();
    }

    /**
     * Continue monitoring after soft ladder while Digi/VIP still Pending / silent.
     */
    protected function scheduleExtendedCheck(Transaction $transaction, int $elapsed): void
    {
        $delay = $this->extendedCheckIntervalSeconds();
        $remaining = max(1, $this->manualReviewAfterSeconds() - $elapsed);
        $delay = min($delay, $remaining);

        // Keep timeout_at as soft deadline for reconcile catch-up; do not push customer to Failed.
        WatchPendingTransactionJob::dispatch($transaction->id, self::EXTENDED_CHECK_INDEX)
            ->delay(now()->addSeconds($delay));

        Log::warning('TX TIMEOUT — soft ladder exhausted; extended monitor (no auto-refund)', [
            'transaction_id' => $transaction->id,
            'elapsed_seconds' => $elapsed,
            'next_delay_seconds' => $delay,
            'manual_review_after_seconds' => $this->manualReviewAfterSeconds(),
            'provider_last_status' => $transaction->provider_last_status,
        ]);
    }

    /**
     * Hard backstop: no final Digi/VIP answer after long wait → human review, no refund.
     */
    protected function markManualReview(Transaction $transaction, int $elapsed, ?ProviderFulfillmentResult $probe): void
    {
        $note = 'Menunggu konfirmasi operator lebih lama dari biasanya. Tim Operations akan meninjau — saldo belum dikembalikan otomatis.';
        $existing = trim((string) $transaction->notes);
        $transaction->forceFill([
            'provider_last_status' => 'manual_review',
            'notes' => mb_substr($existing === '' ? $note : ($existing.' | '.$note), 0, 2000),
        ])->save();

        Log::critical('TX TIMEOUT — manual review required (no auto-refund)', [
            'transaction_id' => $transaction->id,
            'invoice' => $transaction->invoice_number,
            'elapsed_seconds' => $elapsed,
            'provider_code' => $transaction->fulfillment_provider_code,
            'provider_ref' => $transaction->provider_ref,
            'probe_status' => $probe?->status,
            'probe_reason' => $probe?->reason,
        ]);

        $this->persistFinanceAlertSafely([
            'alert_code' => sprintf('ALT-MR-%s-%d', now()->format('YmdHis'), (int) $transaction->id),
            'type' => 'ppob_manual_review',
            'severity' => 'critical',
            'title' => 'PPOB butuh review manual: '.$transaction->invoice_number,
            'body' => 'Transaksi masih Pending tanpa jawaban final Digi/VIP setelah '
                .$elapsed.' detik. Jangan auto-refund — cek Digi dashboard / SN lalu settle manual.',
            'payload' => [
                'transaction_id' => $transaction->id,
                'invoice' => $transaction->invoice_number,
                'elapsed_seconds' => $elapsed,
                'provider_code' => $transaction->fulfillment_provider_code,
                'provider_ref' => $transaction->provider_ref,
                'provider_last_status' => $transaction->provider_last_status,
                'service_name' => $transaction->service_name,
            ],
            'status' => 'open',
            'related_type' => 'transaction',
            'related_id' => (int) $transaction->id,
        ], (int) $transaction->id, 'manual_review');
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    protected function persistFinanceAlertSafely(array $attrs, int $transactionId, string $kind): void
    {
        try {
            $exists = \App\Models\FinanceAlert::query()
                ->where('type', $attrs['type'])
                ->where('related_type', 'transaction')
                ->where('related_id', $transactionId)
                ->where('status', 'open')
                ->exists();
            if (! $exists) {
                \App\Models\FinanceAlert::query()->create($attrs);
            }
        } catch (\Throwable $e) {
            Log::error('TX TIMEOUT — failed to persist '.$kind.' finance alert', [
                'transaction_id' => $transactionId,
                'error' => $e->getMessage(),
            ]);
        }

        // Mirror to Ops Alert Center so Owner/Operations can monitor without Finance role.
        try {
            app(\App\Services\Operations\OpsAlertService::class)->raiseOpen(
                (string) $attrs['type'],
                (string) ($attrs['severity'] ?? 'critical'),
                (string) $attrs['title'],
                (string) $attrs['body'],
                is_array($attrs['payload'] ?? null) ? $attrs['payload'] : [],
                'transaction',
                $transactionId
            );
        } catch (\Throwable $e) {
            Log::error('TX TIMEOUT — failed to persist '.$kind.' ops alert', [
                'transaction_id' => $transactionId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Explicit permanent/final provider failure eligible for auto-refund.
     * Digi: official Status=Gagal (RC catalog) — not Pending/03/99.
     * Other providers: adapter status failed/error.
     */
    protected function isExplicitProviderFailure(Transaction $transaction, ?ProviderFulfillmentResult $probe): bool
    {
        if (! $probe || $probe->ok) {
            return false;
        }

        if (! in_array($probe->status, ['failed', 'error'], true)) {
            return false;
        }

        $code = (string) ($transaction->fulfillment_provider_code ?? '');
        if ($code !== ProductProvider::CODE_DIGIFLAZZ) {
            return true;
        }

        $data = is_array($probe->raw['data'] ?? null) ? $probe->raw['data'] : null;
        if (! is_array($data) || ! array_key_exists('rc', $data)) {
            // Explicit adapter failure without RC — treat as provider-reported fail.
            return true;
        }

        $classified = DigiflazzResponseCodeClassifier::fromResponseData($data);
        if ($classified->isPending() || $classified->isSuccess()) {
            return false;
        }

        // Official Digi Status = Gagal (or refund RC) → refundable explicit failure.
        return strcasecmp($classified->officialStatus(), 'Gagal') === 0
            || $classified->isRefundable()
            || $classified->permanentFailure;
    }

    protected function isInFlight(Transaction $transaction): bool
    {
        // FR-TOPUP-FIX-01 — Top Up (Midtrans) never debits on create; the PPOB
        // timeout/refund ladder must never treat it as in-flight. Reconciled solely
        // by MidtransReconciliationService::pollPendingDeposits().
        if (TransactionStatusMapper::isWalletTopUp($transaction)) {
            return false;
        }

        // SRS 14.3 / 14.4 — LOCKED / SENT_TO_SUPPLIER / PENDING_SUPPLIER + legacy pending
        return TransactionStatusMapper::isFulfillOpen($transaction->status)
            || $transaction->status === TransactionStatus::DRAFT->value;
    }

    protected function probeProvider(Transaction $transaction): ?ProviderFulfillmentResult
    {
        $code = $transaction->fulfillment_provider_code;
        if (!$code || !$this->registry->has($code)) {
            Log::info('TX TIMEOUT — no provider to probe yet', [
                'transaction_id' => $transaction->id,
            ]);

            return null;
        }

        $sku = $transaction->provider_sku_used
            ?: $transaction->digiflazzTransaction?->buyer_sku_code
            ?: $transaction->items->first()?->product_code;

        if (!$sku) {
            return null;
        }

        $adapter = $this->registry->get($code);
        // Digiflazz: same ref_id as original order (prepaid re-Topup / pasca status-pasca).
        // Postpaid Digiflazz must probe with inquiry ref_id (provider_ref), not a new invoice.
        $refId = (string) (
            $transaction->provider_ref
            ?: $transaction->digiflazzTransaction?->ref_id
            ?: $transaction->invoice_number
            ?: ''
        );

        // Enforce Digiflazz ≥60s gap between status probes for the same transaction.
        $minInterval = $this->minCheckIntervalSeconds();
        if (
            $code === ProductProvider::CODE_DIGIFLAZZ
            && $transaction->provider_checked_at
            && $transaction->provider_checked_at->gt(now()->subSeconds($minInterval))
        ) {
            Log::info('CHECK STATUS — skipped (min interval)', [
                'transaction_id' => $transaction->id,
                'provider_code' => $code,
                'min_interval_seconds' => $minInterval,
                'provider_checked_at' => optional($transaction->provider_checked_at)->toIso8601String(),
            ]);

            return ProviderFulfillmentResult::pending(
                0,
                [],
                'Status check skipped: Digiflazz minimum interval '.$minInterval.'s',
                'min_interval_skip'
            );
        }

        Log::info('CHECK STATUS — provider request', [
            'transaction_id' => $transaction->id,
            'provider_code' => $code,
            'provider_sku' => $sku,
            'ref_id' => $refId,
            'provider_ref' => $transaction->provider_ref,
        ]);

        $result = $adapter->checkStatus(
            $transaction,
            (string) $sku,
            (string) $transaction->target_number,
            $refId
        );

        $digiflazzRc = $this->digiflazzStatusRcContext($code, $result);

        Log::info('STATUS RESPONSE — provider result', array_merge(
            [
                'transaction_id' => $transaction->id,
                'provider_code' => $code,
                'status' => $result->status,
                'ok' => $result->ok,
                'message' => $result->message,
                'reason' => $result->reason,
                'sn' => $result->sn,
            ],
            $digiflazzRc
        ));

        ProductProviderLog::create([
            'product_provider_id' => ProductProvider::query()->where('code', $code)->value('id'),
            'transaction_id' => $transaction->id,
            'event_type' => 'status_check',
            'selected_provider_code' => $code,
            'reason' => $result->reason ?? $result->status,
            'response_time_ms' => $result->responseTimeMs,
            'success' => $result->ok && $result->status === 'success',
            'error_message' => $result->ok ? null : ($result->message ?? $result->reason),
            'meta' => array_filter([
                'status' => $result->status,
                'raw' => $result->raw,
                'digiflazz_rc' => $digiflazzRc !== [] ? $digiflazzRc : null,
            ], static fn ($v) => $v !== null),
        ]);

        return $result;
    }

    protected function applySuccess(Transaction $transaction, ProviderFulfillmentResult $result): void
    {
        // P0 — centralized locked SUCCESS writer (poll / reconcile).
        $providerCode = (string) ($transaction->fulfillment_provider_code ?: '');
        $outcome = $this->successTransition->apply($transaction->id, [
            'provider_code' => $providerCode !== '' ? $providerCode : 'provider',
            'source' => 'transaction_timeout_engine',
            'sn' => $result->sn,
            'notes' => 'Transaksi berhasil. SN: '.($result->sn ?? '-'),
            'raw' => $result->raw,
            'raw_item' => $result->raw,
            'provider_response' => is_array($result->raw) ? $result->raw : null,
            'sync_digiflazz_mirror' => $providerCode === ProductProvider::CODE_DIGIFLAZZ,
            'digiflazz_response' => is_array($result->raw) ? $result->raw : [],
        ]);

        Log::info('TX TIMEOUT — settled SUCCESS attempt', [
            'transaction_id' => $transaction->id,
            'outcome' => $outcome['outcome'],
            'events_dispatched' => $outcome['events_dispatched'],
        ]);
    }

    protected function applyFailure(
        Transaction $transaction,
        string $userMessage,
        string $reason,
        string $notifyType
    ): void {
        Log::info('SET FAILED', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
        ]);
        Log::info('REFUND — starting refundOnce', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
        ]);

        // FR-DIFF-09 / SRS 14.5 — timeout settle-as-fail → auto refund via WalletRefundService.
        $result = $this->refundService->refundOnce(
            $transaction,
            'Refund Timeout/Gagal Transaksi: ' . $transaction->invoice_number,
            'transaction_timeout_engine',
            $userMessage,
            TransactionStatus::FAILED->value
        );

        DigiflazzTransaction::where('transaction_id', $transaction->id)
            ->where(function ($q) {
                $q->whereNull('digiflazz_status')
                    ->orWhereNotIn('digiflazz_status', ['success', 'Sukses', 'sukses']);
            })
            ->update([
                'digiflazz_status' => 'failed',
            ]);

        $this->refundService->writeAudit(null, 'TRANSACTION_TIMEOUT_ENGINE', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
            'credited' => $result['credited'],
            'already_refunded' => $result['already_refunded'],
        ]);

        Log::info('WRITE WALLET HISTORY — refund credit', [
            'transaction_id' => $transaction->id,
            'credited' => $result['credited'],
            'already_refunded' => $result['already_refunded'],
        ]);

        Log::info('BROADCAST EVENT — TransactionFailed', [
            'transaction_id' => $transaction->id,
        ]);
        event(new \App\Events\TransactionFailed($result['transaction']));

        Log::info('UPDATE TRANSACTION', [
            'transaction_id' => $transaction->id,
            'action' => 'SET FAILED',
            'reason' => $reason,
            'notify_type' => $notifyType,
            'credited' => $result['credited'],
            'already_refunded' => $result['already_refunded'],
        ]);
    }

    /**
     * Digiflazz RC log fields (no credentials). Empty when not Digiflazz / no RC.
     *
     * @return array<string, mixed>
     */
    protected function digiflazzStatusRcContext(string $providerCode, ProviderFulfillmentResult $result): array
    {
        if ($providerCode !== ProductProvider::CODE_DIGIFLAZZ) {
            return [];
        }

        $data = $result->raw['data'] ?? null;
        if (! is_array($data) || ! array_key_exists('rc', $data)) {
            return [];
        }

        return DigiflazzResponseCodeClassifier::fromResponseData($data)->toLogContext();
    }
}
