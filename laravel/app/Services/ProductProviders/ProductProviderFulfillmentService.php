<?php

namespace App\Services\ProductProviders;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\DigiflazzTransaction;
use App\Models\PaymentHistory;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use App\Models\Transaction;
use App\Models\User;
use App\Services\DigiflazzService;
use App\Services\NotificationService;
use App\Services\WalletRefundService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Multi Product Provider fulfillment with automatic failover.
 * End users never see which provider was selected.
 */
class ProductProviderFulfillmentService
{
    public function __construct(
        protected ProductProviderRegistry $registry,
        protected ProductProviderSelectionService $selection,
        protected ProductProviderHealthService $health,
        protected WalletRefundService $refundService,
        protected NotificationService $notificationService,
    ) {}

    /**
     * Attempt fulfillment across ordered providers until success/pending or exhausted.
     */
    public function fulfill(Transaction $transaction): void
    {
        if (!TransactionStatusMapper::isFulfillOpen($transaction->status)) {
            Log::info('ProductProviderFulfillment skipped — not in-flight', [
                'transaction_id' => $transaction->id,
                'status' => $transaction->status,
            ]);

            return;
        }

        // Sprint 3 (SRS 15.3 / locked decision #2) — atomic local claim. If a prior attempt
        // already claimed this transaction (retry after an ambiguous exception/timeout, or
        // ShouldBeUnique somehow overlapped), never blindly call the provider again — go
        // through the three-outcome retry guard instead (checkStatus first, never blind resend).
        // SRS 14.3 — accept pending/processing/LOCKED; stamp SENT_TO_SUPPLIER on claim.
        $claimed = Transaction::where('id', $transaction->id)
            ->whereIn('status', TransactionStatusMapper::dispatchClaimStatuses())
            ->whereNull('provider_dispatch_started_at')
            ->update([
                'provider_dispatch_started_at' => now(),
                'status' => TransactionStatus::SENT_TO_SUPPLIER->value,
            ]);

        if ($claimed === 0) {
            $this->handleDispatchRetry($transaction->fresh(['items']) ?? $transaction);

            return;
        }

        $transaction = $transaction->fresh(['items']) ?? $transaction;
        $transaction->loadMissing('items');
        $firstItem = $transaction->items->first();
        $internalSku = $firstItem?->product_code ?? '';

        $product = $this->selection->findProductByInternalSku($internalSku);
        if (!$product) {
            Log::error('ProductProviderFulfillment: product not found for internal SKU', [
                'transaction_id' => $transaction->id,
                'sku' => $internalSku,
            ]);
            $this->failAndRefund($transaction, 'Produk tidak tersedia.', 'product_missing');

            return;
        }

        $itemMeta = $firstItem?->custom_metadata ?? [];
        if (!is_array($itemMeta)) {
            $itemMeta = [];
        }
        $isPasca = !empty($itemMeta['is_pasca']) || !empty($itemMeta['inquiry_ref_id']);
        $providerRef = $this->resolveProviderRef($transaction, $itemMeta);

        $candidates = $this->selection->candidatesForProduct($product, $transaction->id);
        // Digiflazz inquiry ref_id cannot be fulfilled by another provider.
        if ($isPasca) {
            $candidates = $candidates->filter(
                fn (ProductProviderSku $o) => $o->productProvider?->code === ProductProvider::CODE_DIGIFLAZZ
            )->values();
        }
        if ($candidates->isEmpty()) {
            Log::warning('PRODUCT ROUTING — no enabled providers', [
                'transaction_id' => $transaction->id,
                'product_id' => $product->id,
            ]);
            $this->failAndRefund($transaction, 'Layanan sedang tidak tersedia. Silakan coba lagi nanti.', 'no_active_provider');

            return;
        }

        Log::info('PRODUCT ROUTING — fulfill start', [
            'transaction_id' => $transaction->id,
            'candidates' => $candidates->map(fn (ProductProviderSku $o) => $o->productProvider?->code)->values()->all(),
            'is_pasca' => $isPasca,
            'provider_ref' => $providerRef,
        ]);

        $attempt = 0;
        $lastResult = null;
        $previousCode = null;
        $candidateList = $candidates->values();
        $total = $candidateList->count();

        foreach ($candidateList as $index => $offer) {
            /** @var ProductProviderSku $offer */
            $provider = $offer->productProvider;
            if (!$provider || !$provider->is_active) {
                continue;
            }

            if (!$this->registry->has($provider->code)) {
                continue;
            }

            $attempt++;
            $adapter = $this->registry->get($provider->code);
            $nextOffer = $candidateList->get($index + 1);
            $nextCode = $nextOffer?->productProvider?->code;

            if (!$adapter->isConfigured()) {
                Log::info('PRODUCT ROUTING — provider skipped', [
                    'transaction_id' => $transaction->id,
                    'provider_code' => $provider->code,
                    'reason_skipped' => 'provider_not_configured',
                ]);
                ProductProviderLog::create([
                    'product_provider_id' => $provider->id,
                    'transaction_id' => $transaction->id,
                    'event_type' => 'failover',
                    'selected_provider_code' => $provider->code,
                    'fallback_provider_code' => $nextCode,
                    'reason' => 'provider_not_configured',
                    'attempt' => $attempt,
                    'success' => false,
                    'error_message' => 'Adapter not configured',
                    'meta' => ['failover_executed' => $nextCode !== null],
                ]);
                $previousCode = $provider->code;
                continue;
            }

            $fulfillSku = $isPasca && !empty($itemMeta['provider_sku'])
                ? (string) $itemMeta['provider_sku']
                : $offer->provider_sku;

            // Digiflazz mirror row (preserve existing DigiflazzTransaction tracking)
            if ($provider->code === ProductProvider::CODE_DIGIFLAZZ) {
                DigiflazzTransaction::firstOrCreate(
                    ['transaction_id' => $transaction->id],
                    [
                        'ref_id' => $providerRef,
                        'buyer_sku_code' => $fulfillSku,
                        'customer_no' => $transaction->target_number,
                        'digiflazz_status' => 'pending',
                    ]
                );
            }

            Log::info('PRODUCT ROUTING — provider selected', [
                'transaction_id' => $transaction->id,
                'provider_code' => $provider->code,
                'attempt' => $attempt,
                'of' => $total,
                'provider_sku' => $fulfillSku,
                'previous_provider' => $previousCode,
            ]);

            $this->selection->logSelection(
                $transaction->id,
                $provider,
                $nextOffer?->productProvider,
                $attempt === 1 ? 'primary_selection' : 'failover_selection',
                [
                    'attempt' => $attempt,
                    'previous_provider' => $previousCode,
                    'provider_sku' => $fulfillSku,
                    'internal_sku' => $internalSku,
                ]
            );

            // Sprint 3 — record intent BEFORE calling the adapter (not only after a confirmed
            // response). If this exact call throws/times out ambiguously, a retry-guard
            // invocation (handleDispatchRetry) needs this context to call checkStatus() on
            // the right provider/sku/ref instead of blindly resending.
            $transaction->forceFill([
                'fulfillment_provider_code' => $provider->code,
                'provider_sku_used' => $fulfillSku,
                'provider_ref' => $transaction->provider_ref ?: $providerRef,
            ])->save();

            $result = $adapter->fulfill(
                $transaction,
                $fulfillSku,
                (string) $transaction->target_number,
                $providerRef
            );
            $lastResult = $result;

            ProductProviderLog::create([
                'product_provider_id' => $provider->id,
                'transaction_id' => $transaction->id,
                'event_type' => 'fulfill_attempt',
                'selected_provider_code' => $provider->code,
                'fallback_provider_code' => $result->shouldFailover ? $nextCode : null,
                'reason' => $result->reason ?? $result->status,
                'response_time_ms' => $result->responseTimeMs,
                'attempt' => $attempt,
                'success' => $result->ok && in_array($result->status, ['success', 'pending'], true),
                'error_message' => $result->ok ? null : ($result->message ?? $result->reason),
                'meta' => array_filter([
                    'status' => $result->status,
                    'should_failover' => $result->shouldFailover,
                    'failover_executed' => $result->shouldFailover && $nextCode !== null,
                    'internal_sku' => $internalSku,
                    'provider_sku' => $offer->provider_sku,
                    'digiflazz_rc' => $this->digiflazzRcLogContext($provider->code, $result),
                ], static fn ($v) => $v !== null),
            ]);

            $this->health->recordFulfillmentOutcome($provider, $result);

            if ($result->ok && $result->status === 'success') {
                Log::info('PRODUCT ROUTING — success', [
                    'transaction_id' => $transaction->id,
                    'provider_code' => $provider->code,
                    'attempt' => $attempt,
                ]);
                $this->rememberFulfillmentContext($transaction, $provider, $offer, $result);
                $this->markSuccess($transaction, $provider, $result);

                return;
            }

            if ($result->ok && $result->status === 'pending') {
                $this->rememberFulfillmentContext($transaction, $provider, $offer, $result);
                $this->markPending($transaction, $provider, $result);

                return;
            }

            // Sprint 10 / SRS 15.3 — after HTTP dispatch may have reached the provider
            // (timeout / ambiguous), NEVER fulfill on provider B. checkStatus(A) only.
            if ($this->isAmbiguousPostDispatchFailure($result)) {
                Log::warning('PRODUCT ROUTING — ambiguous post-dispatch; checkStatus only (no failover)', [
                    'transaction_id' => $transaction->id,
                    'provider_code' => $provider->code,
                    'reason' => $result->reason,
                ]);
                ProductProviderLog::create([
                    'product_provider_id' => $provider->id,
                    'transaction_id' => $transaction->id,
                    'event_type' => 'failover',
                    'selected_provider_code' => $provider->code,
                    'fallback_provider_code' => null,
                    'reason' => 'ambiguous_post_dispatch_no_failover',
                    'attempt' => $attempt,
                    'success' => false,
                    'error_message' => $result->message,
                    'meta' => [
                        'original_reason' => $result->reason,
                        'failover_executed' => false,
                        'check_status_required' => true,
                    ],
                ]);
                $this->rememberFulfillmentContext($transaction, $provider, $offer, $result);
                $this->resolveAmbiguousPostDispatch(
                    $transaction->fresh(['items']) ?? $transaction,
                    $provider,
                    $fulfillSku,
                    $providerRef
                );

                return;
            }

            // Failed — failover if allowed and more candidates remain (pre-processed only)
            if ($result->shouldFailover) {
                Log::info('PRODUCT ROUTING — failover executed', [
                    'transaction_id' => $transaction->id,
                    'from' => $provider->code,
                    'to' => $nextCode,
                    'reason' => $result->reason ?? 'failover',
                ]);
                ProductProviderLog::create([
                    'product_provider_id' => $provider->id,
                    'transaction_id' => $transaction->id,
                    'event_type' => 'failover',
                    'selected_provider_code' => $provider->code,
                    'fallback_provider_code' => $nextCode,
                    'reason' => $result->reason ?? 'failover',
                    'attempt' => $attempt,
                    'success' => false,
                    'error_message' => $result->message,
                    'meta' => [
                        'failover_executed' => $nextCode !== null,
                        'next' => $nextCode,
                    ],
                ]);
                $previousCode = $provider->code;
                continue;
            }

            // Hard reject — stop chain (customer / non-failover error)
            Log::info('PRODUCT ROUTING — hard stop (no failover)', [
                'transaction_id' => $transaction->id,
                'provider_code' => $provider->code,
                'reason' => $result->reason ?? 'provider_rejected',
            ]);
            if ($provider->code === ProductProvider::CODE_DIGIFLAZZ && is_array($result->raw) && $result->raw !== []) {
                DigiflazzTransaction::where('transaction_id', $transaction->id)->update(
                    DigiflazzService::digiflazzTransactionAttributesFromResponse('failed', $result->raw, $result->sn)
                );
            }
            $this->failAndRefund(
                $transaction,
                'Transaksi gagal diproses. Saldo akan dikembalikan bila sudah dipotong.',
                $result->reason ?? 'provider_rejected'
            );

            return;
        }

        $this->failAndRefund(
            $transaction,
            'Layanan sedang mengalami gangguan. Silakan coba beberapa saat lagi.',
            $lastResult?->reason ?? 'all_providers_exhausted'
        );
    }

    protected function markSuccess(Transaction $transaction, ProductProvider $provider, ProviderFulfillmentResult $result): void
    {
        DB::transaction(function () use ($transaction, $provider, $result) {
            /** @var Transaction $locked */
            $locked = Transaction::where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            if (!$this->assertCanWriteFulfillmentStatus($locked, 'SET SUCCESS')) {
                return;
            }

            Log::info('UPDATE TRANSACTION', [
                'transaction_id' => $locked->id,
                'action' => 'SET SUCCESS',
                'provider_code' => $provider->code,
                'provider_ref' => $locked->provider_ref,
                'sn' => $result->sn,
            ]);
            Log::info('SET SUCCESS', [
                'transaction_id' => $locked->id,
                'provider_ref' => $locked->provider_ref,
            ]);

            $locked->update([
                'status' => TransactionStatus::SUCCESS->value,
                'notes' => 'Transaksi berhasil. SN: ' . ($result->sn ?? '-'),
                'provider_last_status' => 'success',
                'provider_checked_at' => now(),
                'completed_at' => now(),
                'provider_response' => is_array($result->raw) ? $result->raw : $locked->provider_response,
            ]);

            if ($provider->code === ProductProvider::CODE_DIGIFLAZZ) {
                DigiflazzTransaction::where('transaction_id', $locked->id)->update(
                    DigiflazzService::digiflazzTransactionAttributesFromResponse(
                        'success',
                        is_array($result->raw) ? $result->raw : [],
                        $result->sn
                    )
                );
            }

            PaymentHistory::recordFor(
                $locked,
                $provider->code,
                'success',
                $result->raw,
                $result->raw,
                $locked->invoice_number
            );

            Log::info('WRITE WALLET HISTORY — debit already finalized (no refund)', [
                'transaction_id' => $locked->id,
                'total_payment' => $locked->total_payment,
            ]);

            Log::info('BROADCAST EVENT — dispatch TransactionSuccess + PaymentSettled', [
                'transaction_id' => $locked->id,
            ]);
            event(new \App\Events\TransactionSuccess($locked->fresh(['user']) ?? $locked));
            event(new \App\Events\PaymentSettled($locked->fresh(['user']) ?? $locked, $result->raw));
        });
    }

    protected function markPending(Transaction $transaction, ProductProvider $provider, ProviderFulfillmentResult $result): void
    {
        $applied = false;
        $fresh = null;

        DB::transaction(function () use ($transaction, $provider, $result, &$applied, &$fresh) {
            /** @var Transaction $locked */
            $locked = Transaction::where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            if (!$this->assertCanWriteFulfillmentStatus($locked, 'SET PENDING')) {
                return;
            }

            // SRS 14.3 — unclear / awaiting supplier → PENDING_SUPPLIER (saldo tetap ter-hold).
            $locked->update([
                'status' => TransactionStatus::PENDING_SUPPLIER->value,
                'notes' => 'Sedang diproses oleh operator.',
                'provider_last_status' => 'pending',
                'provider_checked_at' => now(),
                'provider_response' => is_array($result->raw) ? $result->raw : $locked->provider_response,
            ]);

            if ($provider->code === ProductProvider::CODE_DIGIFLAZZ) {
                DigiflazzTransaction::where('transaction_id', $locked->id)->update(
                    DigiflazzService::digiflazzTransactionAttributesFromResponse(
                        'pending',
                        is_array($result->raw) ? $result->raw : [],
                        $result->sn
                    )
                );
            }

            $applied = true;
            $fresh = $locked->fresh();
        });

        if (!$applied || !$fresh) {
            return;
        }

        Log::info('UPDATE TRANSACTION', [
            'transaction_id' => $fresh->id,
            'action' => 'SET PENDING (awaiting provider final status)',
            'provider_code' => $provider->code,
            'provider_ref' => $fresh->provider_ref,
        ]);

        try {
            app(\App\Services\Transactions\TransactionTimeoutService::class)
                ->scheduleEarlyStatusPoll($fresh);
        } catch (\Throwable $e) {
            Log::warning('Failed to schedule early status poll', [
                'transaction_id' => $fresh->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * SRS 14.3 / 14.4 — same in-flight definition as TransactionTimeoutService.
     */
    protected function isInFlight(Transaction $transaction): bool
    {
        return TransactionStatusMapper::isFulfillOpen($transaction->status)
            || $transaction->status === TransactionStatus::DRAFT->value;
    }

    /**
     * Guard late provider callbacks from overwriting terminal/refunded rows (P0-1).
     */
    protected function assertCanWriteFulfillmentStatus(Transaction $locked, string $attemptedAction): bool
    {
        if (!$this->isInFlight($locked)) {
            Log::warning('PRODUCT ROUTING — skip status write; not in-flight', [
                'transaction_id' => $locked->id,
                'current_status' => $locked->status,
                'attempted_action' => $attemptedAction,
            ]);

            return false;
        }

        if ($locked->refunded_at || $this->refundService->hasExistingRefund($locked)) {
            Log::warning('PRODUCT ROUTING — skip status write; already refunded', [
                'transaction_id' => $locked->id,
                'current_status' => $locked->status,
                'attempted_action' => $attemptedAction,
            ]);

            return false;
        }

        return true;
    }

    /**
     * Row-locked transition to PENDING_SUPPLIER for ambiguous/retry deferral paths.
     */
    protected function transitionToPendingSupplier(Transaction $transaction, string $attemptedAction): void
    {
        DB::transaction(function () use ($transaction, $attemptedAction) {
            /** @var Transaction $locked */
            $locked = Transaction::where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === TransactionStatus::PENDING_SUPPLIER->value) {
                return;
            }

            if (!$this->assertCanWriteFulfillmentStatus($locked, $attemptedAction)) {
                return;
            }

            $locked->update([
                'status' => TransactionStatus::PENDING_SUPPLIER->value,
                'notes' => 'Sedang diproses oleh operator.',
            ]);
        });
    }

    protected function rememberFulfillmentContext(
        Transaction $transaction,
        ProductProvider $provider,
        ProductProviderSku $offer,
        ProviderFulfillmentResult $result
    ): void {
        $raw = is_array($result->raw) ? $result->raw : [];
        $extracted = $provider->code === ProductProvider::CODE_VIP
            ? VipOrderPayload::extract($raw, $transaction->provider_ref)
            : [
                'trxid' => $raw['data']['trxid']
                    ?? $raw['data']['trx_id']
                    ?? $raw['data']['ref_id']
                    ?? $raw['trxid']
                    ?? null,
                'provider_time' => null,
            ];

        $providerRef = $extracted['trxid'] ?? null;
        $providerTime = null;
        if (!empty($extracted['provider_time'])) {
            try {
                $providerTime = \Carbon\Carbon::parse((string) $extracted['provider_time']);
            } catch (\Throwable) {
                $providerTime = null;
            }
        }

        $skuUsed = $transaction->items->first()?->custom_metadata['provider_sku']
            ?? $offer->provider_sku;

        $transaction->forceFill([
            'fulfillment_provider_code' => $provider->code,
            'provider_sku_used' => $skuUsed,
            // Prefer existing inquiry/provider_ref for pasca; Digiflazz echoes same ref_id.
            'provider_ref' => $transaction->provider_ref
                ?: ($providerRef ? (string) $providerRef : null),
            'provider_response' => $raw !== [] ? $raw : $transaction->provider_response,
            'provider_transaction_time' => $providerTime ?? $transaction->provider_transaction_time ?? now(),
        ])->save();

        Log::info('STORE PROVIDER REF', [
            'transaction_id' => $transaction->id,
            'provider_code' => $provider->code,
            'provider_sku' => $skuUsed,
            'provider_ref' => $transaction->fresh()?->provider_ref,
            'provider_transaction_time' => optional($transaction->fresh()?->provider_transaction_time)->toIso8601String(),
        ]);
    }

    /**
     * Digiflazz pay-pasca must reuse inquiry ref_id; prepaid uses invoice_number.
     *
     * @param  array<string, mixed>  $itemMeta
     */
    protected function resolveProviderRef(Transaction $transaction, array $itemMeta = []): string
    {
        $inquiryRef = $itemMeta['inquiry_ref_id'] ?? null;
        if (is_string($inquiryRef) && trim($inquiryRef) !== '') {
            return trim($inquiryRef);
        }
        if (!empty($transaction->provider_ref)) {
            return (string) $transaction->provider_ref;
        }

        return (string) $transaction->invoice_number;
    }

    /**
     * Sprint 10 / SRS 15.3 — timeout / connection after a dispatch attempt is ambiguous:
     * the provider may already have the order. Never dual-dispatch; checkStatus only.
     */
    protected function isAmbiguousPostDispatchFailure(ProviderFulfillmentResult $result): bool
    {
        $reason = strtolower((string) ($result->reason ?? ''));
        if (in_array($reason, ['timeout', 'connection_error'], true)) {
            return true;
        }

        $message = strtolower((string) ($result->message ?? ''));

        return $reason === 'provider_exception'
            && (str_contains($message, 'timeout') || str_contains($message, 'timed out') || str_contains($message, 'cURL error 28'));
    }

    /**
     * After ambiguous post-dispatch failure: checkStatus on the same provider/ref only.
     */
    protected function resolveAmbiguousPostDispatch(
        Transaction $transaction,
        ProductProvider $provider,
        string $sku,
        string $refId
    ): void {
        if (! $this->registry->has($provider->code)) {
            $this->transitionToPendingSupplier($transaction, 'SET PENDING_SUPPLIER (adapter missing)');

            return;
        }

        $adapter = $this->registry->get($provider->code);
        $result = $adapter->checkStatus(
            $transaction,
            $sku,
            (string) $transaction->target_number,
            $refId
        );

        ProductProviderLog::create([
            'product_provider_id' => $provider->id,
            'transaction_id' => $transaction->id,
            'event_type' => 'post_dispatch_check',
            'selected_provider_code' => $provider->code,
            'reason' => $result->reason ?? $result->status,
            'response_time_ms' => $result->responseTimeMs,
            'success' => $result->ok,
            'error_message' => $result->ok ? null : ($result->message ?? $result->reason),
            'meta' => ['status' => $result->status, 'ref_id' => $refId],
        ]);

        if ($result->ok && $result->status === 'success') {
            $this->markSuccess($transaction, $provider, $result);

            return;
        }

        if ($result->ok && $result->status === 'pending') {
            $this->markPending($transaction, $provider, $result);

            return;
        }

        $ambiguousReasons = ['provider_not_configured', 'status_check_window_expired', 'timeout', 'connection_error'];
        if (! $result->ok && $result->status === 'failed' && ! in_array($result->reason, $ambiguousReasons, true)) {
            $this->failAndRefund(
                $transaction,
                'Transaksi gagal diproses. Saldo akan dikembalikan bila sudah dipotong.',
                $result->reason ?? 'provider_rejected_on_post_dispatch_check'
            );

            return;
        }

        $this->transitionToPendingSupplier($transaction, 'SET PENDING_SUPPLIER (post-dispatch inconclusive)');

        Log::warning('PRODUCT ROUTING — post-dispatch check inconclusive, deferring to reconciliation', [
            'transaction_id' => $transaction->id,
            'provider_code' => $provider->code,
            'status' => $result->status,
            'reason' => $result->reason,
        ]);
    }

    /**
     * Sprint 3 (SRS 15.3 / locked decision #2/#9) — three-outcome retry guard.
     * Invoked only when a prior dispatch attempt already claimed this transaction
     * (provider_dispatch_started_at set). Never calls fulfill()/buy() again; only
     * checkStatus() may run, and only one of three outcomes may result:
     *
     *   A. CONFIRMED EXISTS  (ok=true, success|pending) — apply existing success/pending
     *      handling, never resend.
     *   B. CONFIRMED FAILED  (ok=false, status=failed, not a local/ambiguous guard reason)
     *      — existing failAndRefund()/refundOnce() path, never dispatch again.
     *   C. UNKNOWN / TIMEOUT / UNABLE TO DETERMINE — no resend, no refund, transaction
     *      stays in-flight; existing TransactionTimeoutService / reconcile-pending resolves it.
     */
    protected function handleDispatchRetry(Transaction $transaction): void
    {
        if (!TransactionStatusMapper::isFulfillOpen($transaction->status)) {
            return;
        }

        $code = $transaction->fulfillment_provider_code;
        if (!$code || !$this->registry->has($code)) {
            // Outcome C — the earlier attempt never got far enough to record which provider
            // it targeted (e.g. crashed before the adapter call context could be persisted).
            // Nothing safe to check; defer entirely to existing reconciliation.
            Log::warning('PRODUCT ROUTING — dispatch retry: no known provider context, deferring to reconciliation', [
                'transaction_id' => $transaction->id,
            ]);

            return;
        }

        $provider = ProductProvider::query()->where('code', $code)->first();
        $sku = $transaction->provider_sku_used ?: $transaction->items->first()?->product_code;
        $refId = (string) ($transaction->provider_ref ?: $transaction->invoice_number);

        if (!$provider || !$sku) {
            Log::warning('PRODUCT ROUTING — dispatch retry: insufficient context, deferring to reconciliation', [
                'transaction_id' => $transaction->id,
                'provider_code' => $code,
            ]);

            return;
        }

        $adapter = $this->registry->get($code);

        Log::info('PRODUCT ROUTING — dispatch retry: checkStatus before any possible resend', [
            'transaction_id' => $transaction->id,
            'provider_code' => $code,
            'provider_sku' => $sku,
            'ref_id' => $refId,
        ]);

        $result = $adapter->checkStatus($transaction, (string) $sku, (string) $transaction->target_number, $refId);

        ProductProviderLog::create([
            'product_provider_id' => $provider->id,
            'transaction_id' => $transaction->id,
            'event_type' => 'dispatch_retry_check',
            'selected_provider_code' => $code,
            'reason' => $result->reason ?? $result->status,
            'response_time_ms' => $result->responseTimeMs,
            'success' => $result->ok,
            'error_message' => $result->ok ? null : ($result->message ?? $result->reason),
            'meta' => ['status' => $result->status],
        ]);

        // A. CONFIRMED EXISTS — order handle exists at the provider (resolved or still
        // in flight). Never resend; use the same success/pending handling as the normal path.
        if ($result->ok && $result->status === 'success') {
            $this->markSuccess($transaction, $provider, $result);

            return;
        }

        if ($result->ok && $result->status === 'pending') {
            $this->markPending($transaction, $provider, $result);

            return;
        }

        // B. CONFIRMED FAILED — an explicit, provider-confirmed rejection for this ref_id
        // (not a local/ambiguous guard reason such as provider_not_configured or the
        // Digiflazz prepaid status_check_window_expired guard). Safe to close out via the
        // existing refund path; never dispatch again.
        $ambiguousReasons = ['provider_not_configured', 'status_check_window_expired'];
        if (!$result->ok && $result->status === 'failed' && !in_array($result->reason, $ambiguousReasons, true)) {
            $this->failAndRefund(
                $transaction,
                'Transaksi gagal diproses. Saldo akan dikembalikan bila sudah dipotong.',
                $result->reason ?? 'provider_rejected_on_retry_check'
            );

            return;
        }

        // C. UNKNOWN / TIMEOUT / UNABLE TO DETERMINE — status='error', or a local/ambiguous
        // guard reason. Never resend, never refund here; leave in-flight as PENDING_SUPPLIER
        // for the existing TransactionTimeoutService ladder / transactions:reconcile-pending.
        $this->transitionToPendingSupplier($transaction, 'SET PENDING_SUPPLIER (dispatch retry inconclusive)');

        Log::warning('PRODUCT ROUTING — dispatch retry inconclusive, deferring to reconciliation', [
            'transaction_id' => $transaction->id,
            'provider_code' => $code,
            'status' => $result->status,
            'reason' => $result->reason,
        ]);
    }

    /**
     * FR-DIFF-09 / SRS 14.5 — confirmed provider failure → FAILED + auto wallet credit.
     */
    protected function failAndRefund(Transaction $transaction, string $userMessage, string $reason): void
    {
        if (!TransactionStatusMapper::isFulfillOpen($transaction->status)) {
            return;
        }

        $result = $this->refundService->refundOnce(
            $transaction,
            'Refund Gagal Transaksi: ' . $transaction->invoice_number,
            'product_provider_fulfillment',
            $userMessage,
            TransactionStatus::FAILED->value
        );

        DigiflazzTransaction::where('transaction_id', $transaction->id)->update([
            'digiflazz_status' => 'failed',
        ]);

        event(new \App\Events\TransactionFailed($result['transaction']));

        // Notification + broadcast handled by listeners (SendNotification / BroadcastEvent)

        Log::info('SET FAILED', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
            'credited' => $result['credited'],
        ]);
        Log::error('ProductProviderFulfillment failed', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
        ]);
    }

    /**
     * Exhausted job retries — same UX as Digiflazz permanent failure.
     */
    public function onJobExhausted(Transaction $transaction, ?\Throwable $exception): void
    {
        if (!TransactionStatusMapper::isFulfillOpen($transaction->status)) {
            return;
        }

        $result = $this->refundService->refundOnce(
            $transaction,
            'Refund Gagal Transaksi (Job Exhausted): ' . $transaction->invoice_number,
            'product_provider_job_failed',
            'Transaksi gagal permanen setelah retry: ' . ($exception?->getMessage() ?? 'unknown'),
            TransactionStatus::FAILED->value
        );

        DigiflazzTransaction::where('transaction_id', $transaction->id)->update([
            'digiflazz_status' => 'failed',
        ]);

        $fresh = $result['transaction'];
        event(new \App\Events\TransactionFailed($fresh));

        if ($fresh->user) {
            $this->notificationService->send(
                $fresh->user,
                'Transaksi Gagal',
                'Transaksi ' . $fresh->invoice_number . ' gagal diproses. Saldo telah dikembalikan ke dompet Anda.',
                'transaction_failed',
                ['database']
            );
        }

        User::query()
            ->whereIn('role', [UserRole::FINANCE->value, UserRole::OWNER->value])
            ->orderBy('id')
            ->chunkById(50, function ($users) use ($fresh, $exception) {
                foreach ($users as $user) {
                    $this->notificationService->send(
                        $user,
                        'Product Provider Job Failed',
                        'Transaksi ' . $fresh->invoice_number . ' gagal permanen setelah retry. '
                            . ($exception?->getMessage() ?? ''),
                        'provider_failure',
                        ['database']
                    );
                }
            });
    }

    /**
     * Digiflazz RC log context for fulfill meta (no credentials).
     *
     * @return array<string, mixed>|null
     */
    protected function digiflazzRcLogContext(string $providerCode, ProviderFulfillmentResult $result): ?array
    {
        if ($providerCode !== ProductProvider::CODE_DIGIFLAZZ) {
            return null;
        }

        $data = $result->raw['data'] ?? null;
        if (! is_array($data) || ! array_key_exists('rc', $data)) {
            return null;
        }

        return DigiflazzResponseCodeClassifier::fromResponseData($data)->toLogContext();
    }
}
