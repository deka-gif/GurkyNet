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

        $candidates = $this->selection->candidatesForProduct($product);
        if ($candidates->isEmpty()) {
            Log::warning('ProductProviderFulfillment: no enabled providers', [
                'transaction_id' => $transaction->id,
                'product_id' => $product->id,
            ]);
            $this->failAndRefund($transaction, 'Layanan sedang tidak tersedia. Silakan coba lagi nanti.', 'no_active_provider');

            return;
        }

        $attempt = 0;
        $lastResult = null;
        $previousCode = null;

        foreach ($candidates as $offer) {
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

            if (!$adapter->isConfigured()) {
                ProductProviderLog::create([
                    'product_provider_id' => $provider->id,
                    'transaction_id' => $transaction->id,
                    'event_type' => 'failover',
                    'selected_provider_code' => $provider->code,
                    'fallback_provider_code' => null,
                    'reason' => 'provider_not_configured',
                    'attempt' => $attempt,
                    'success' => false,
                    'error_message' => 'Adapter not configured',
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

            $this->selection->logSelection(
                $transaction->id,
                $provider,
                null,
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
                'fallback_provider_code' => null,
                'reason' => $result->reason ?? $result->status,
                'response_time_ms' => $result->responseTimeMs,
                'attempt' => $attempt,
                'success' => $result->ok && in_array($result->status, ['success', 'pending'], true),
                'error_message' => $result->ok ? null : ($result->message ?? $result->reason),
                'meta' => [
                    'status' => $result->status,
                    'should_failover' => $result->shouldFailover,
                    'internal_sku' => $internalSku,
                    // provider_sku logged for ops only — never returned to user APIs
                    'provider_sku' => $offer->provider_sku,
                ],
            ]);

            $this->health->recordFulfillmentOutcome($provider, $result);

            if ($result->ok && $result->status === 'success') {
                $this->markSuccess($transaction, $provider, $result);

                return;
            }

            if ($result->ok && $result->status === 'pending') {
                $this->markPending($transaction, $provider, $result);

                return;
            }

            // Failed — failover if allowed and more candidates remain
            if ($result->shouldFailover) {
                ProductProviderLog::create([
                    'product_provider_id' => $provider->id,
                    'transaction_id' => $transaction->id,
                    'event_type' => 'failover',
                    'selected_provider_code' => $provider->code,
                    'fallback_provider_code' => null,
                    'reason' => $result->reason ?? 'failover',
                    'attempt' => $attempt,
                    'success' => false,
                    'error_message' => $result->message,
                    'meta' => ['next' => true],
                ]);
                $previousCode = $provider->code;
                continue;
            }

            // Hard reject — stop chain
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
        $transaction->update([
            'status' => TransactionStatus::SUCCESS->value,
            'notes' => 'Transaksi sukses. SN: ' . ($result->sn ?? '-'),
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

        event(new \App\Events\TransactionSuccess($transaction));
        event(new \App\Events\PaymentSettled($transaction, $result->raw));
    }

    protected function markPending(Transaction $transaction, ProductProvider $provider, ProviderFulfillmentResult $result): void
    {
        $transaction->update([
            'status' => TransactionStatus::PROCESSING->value,
            'notes' => 'Sedang diproses oleh operator.',
        ]);

        if ($provider->code === ProductProvider::CODE_DIGIFLAZZ) {
            DigiflazzTransaction::where('transaction_id', $transaction->id)->update([
                'digiflazz_status' => 'pending',
                'raw_response' => $result->raw,
            ]);
        }
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

        if ($result['transaction']->user) {
            $this->notificationService->send(
                $result['transaction']->user,
                'Transaksi Gagal',
                'Transaksi ' . $result['transaction']->invoice_number . ' gagal diproses. Saldo telah dikembalikan ke dompet Anda.',
                'transaction_failed',
                ['database']
            );
        }

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
