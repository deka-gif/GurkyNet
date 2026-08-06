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
use App\Services\NotificationService;
use App\Services\WalletRefundService;
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
        if (!in_array($transaction->status, [
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ], true)) {
            Log::info('ProductProviderFulfillment skipped — not in-flight', [
                'transaction_id' => $transaction->id,
                'status' => $transaction->status,
            ]);

            return;
        }

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

        $candidates = $this->selection->candidatesForProduct($product, $transaction->id);
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

            // Digiflazz mirror row (preserve existing DigiflazzTransaction tracking)
            if ($provider->code === ProductProvider::CODE_DIGIFLAZZ) {
                DigiflazzTransaction::firstOrCreate(
                    ['transaction_id' => $transaction->id],
                    [
                        'ref_id' => $transaction->invoice_number,
                        'buyer_sku_code' => $offer->provider_sku,
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
                'provider_sku' => $offer->provider_sku,
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
                    'provider_sku' => $offer->provider_sku,
                    'internal_sku' => $internalSku,
                ]
            );

            $result = $adapter->fulfill(
                $transaction,
                $offer->provider_sku,
                (string) $transaction->target_number,
                (string) $transaction->invoice_number
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
                'meta' => [
                    'status' => $result->status,
                    'should_failover' => $result->shouldFailover,
                    'failover_executed' => $result->shouldFailover && $nextCode !== null,
                    'internal_sku' => $internalSku,
                    'provider_sku' => $offer->provider_sku,
                ],
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

            // Failed — failover if allowed and more candidates remain
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
        $transaction->loadMissing('user');

        Log::info('UPDATE TRANSACTION', [
            'transaction_id' => $transaction->id,
            'action' => 'SET SUCCESS',
            'provider_code' => $provider->code,
            'provider_ref' => $transaction->provider_ref,
            'sn' => $result->sn,
        ]);
        Log::info('SET SUCCESS', [
            'transaction_id' => $transaction->id,
            'provider_ref' => $transaction->provider_ref,
        ]);

        $transaction->update([
            'status' => TransactionStatus::SUCCESS->value,
            'notes' => 'Transaksi berhasil. SN: ' . ($result->sn ?? '-'),
            'provider_last_status' => 'success',
            'provider_checked_at' => now(),
            'completed_at' => now(),
            'provider_response' => is_array($result->raw) ? $result->raw : $transaction->provider_response,
        ]);

        if ($provider->code === ProductProvider::CODE_DIGIFLAZZ) {
            DigiflazzTransaction::where('transaction_id', $transaction->id)->update([
                'digiflazz_status' => 'success',
                'sn' => $result->sn,
                'raw_response' => $result->raw,
            ]);
        }

        PaymentHistory::recordFor(
            $transaction,
            $provider->code,
            'success',
            $result->raw,
            $result->raw,
            $transaction->invoice_number
        );

        Log::info('WRITE WALLET HISTORY — debit already finalized (no refund)', [
            'transaction_id' => $transaction->id,
            'total_payment' => $transaction->total_payment,
        ]);

        // Listeners: SendNotification ("Pembayaran Berhasil"), BroadcastEvent, WriteAuditLog, AnalyticsCollector
        Log::info('BROADCAST EVENT — dispatch TransactionSuccess + PaymentSettled', [
            'transaction_id' => $transaction->id,
        ]);
        event(new \App\Events\TransactionSuccess($transaction->fresh(['user']) ?? $transaction));
        event(new \App\Events\PaymentSettled($transaction->fresh(['user']) ?? $transaction, $result->raw));
    }

    protected function markPending(Transaction $transaction, ProductProvider $provider, ProviderFulfillmentResult $result): void
    {
        // VIP waiting/processing → keep as PENDING so UI + timeout engine stay in-flight.
        $transaction->update([
            'status' => TransactionStatus::PENDING->value,
            'notes' => 'Sedang diproses oleh operator.',
            'provider_last_status' => 'pending',
            'provider_checked_at' => now(),
            'provider_response' => is_array($result->raw) ? $result->raw : $transaction->provider_response,
        ]);

        if ($provider->code === ProductProvider::CODE_DIGIFLAZZ) {
            DigiflazzTransaction::where('transaction_id', $transaction->id)->update([
                'digiflazz_status' => 'pending',
                'raw_response' => $result->raw,
            ]);
        }

        Log::info('UPDATE TRANSACTION', [
            'transaction_id' => $transaction->id,
            'action' => 'SET PENDING (awaiting provider final status)',
            'provider_code' => $provider->code,
            'provider_ref' => $transaction->fresh()?->provider_ref,
        ]);

        // Ensure an early status poll runs soon after order acceptance (provider_ref must already be saved).
        try {
            app(\App\Services\Transactions\TransactionTimeoutService::class)
                ->scheduleEarlyStatusPoll($transaction->fresh() ?? $transaction);
        } catch (\Throwable $e) {
            Log::warning('Failed to schedule early status poll', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);
        }
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

        $transaction->forceFill([
            'fulfillment_provider_code' => $provider->code,
            'provider_sku_used' => $offer->provider_sku,
            'provider_ref' => $providerRef ? (string) $providerRef : $transaction->provider_ref,
            'provider_response' => $raw !== [] ? $raw : $transaction->provider_response,
            'provider_transaction_time' => $providerTime ?? $transaction->provider_transaction_time ?? now(),
        ])->save();

        Log::info('STORE PROVIDER REF', [
            'transaction_id' => $transaction->id,
            'provider_code' => $provider->code,
            'provider_sku' => $offer->provider_sku,
            'provider_ref' => $transaction->fresh()?->provider_ref,
            'provider_transaction_time' => optional($transaction->fresh()?->provider_transaction_time)->toIso8601String(),
        ]);
    }

    protected function failAndRefund(Transaction $transaction, string $userMessage, string $reason): void
    {
        if (!in_array($transaction->status, [
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ], true)) {
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
        if (!in_array($transaction->status, [
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ], true)) {
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
}
