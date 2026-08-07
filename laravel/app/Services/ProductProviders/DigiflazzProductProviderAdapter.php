<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Services\DigiflazzService;
use Illuminate\Support\Facades\Log;

/**
 * Digiflazz product-provider adapter.
 * Preserves existing Digiflazz buy semantics used by ProcessDigiflazzTransaction.
 *
 * Status monitoring (Digiflazz Cek Status.pdf):
 * - PREPAID: re-Topup with the same ref_id (via DigiflazzService::checkStatus → buy).
 * - POSTPAID: commands=status-pasca (DigiflazzService::checkStatusPasca).
 * WatchPendingTransactionJob drives polling; min interval is enforced at 60 seconds.
 */
class DigiflazzProductProviderAdapter implements ProductProviderAdapterInterface
{
    /** Digiflazz: do not status-check prepaid txs older than 90 days (creates a NEW tx). */
    public const PREPAID_STATUS_MAX_AGE_DAYS = 90;

    public function __construct(
        protected DigiflazzService $digiflazz,
        protected ProviderFailoverPolicy $failoverPolicy,
    ) {}

    public function code(): string
    {
        return ProductProvider::CODE_DIGIFLAZZ;
    }

    public function isConfigured(): bool
    {
        return $this->digiflazz->isConfigured();
    }

    public function fulfill(
        Transaction $transaction,
        string $providerSku,
        string $customerNo,
        string $refId
    ): ProviderFulfillmentResult {
        $started = microtime(true);

        try {
            if (!$this->isConfigured()) {
                return ProviderFulfillmentResult::error(
                    (int) ((microtime(true) - $started) * 1000),
                    'provider_not_configured',
                    true,
                    'Digiflazz credentials are not configured.'
                );
            }

            $isPasca = $this->isPascaTransaction($transaction);
            $response = $isPasca
                ? $this->digiflazz->payPasca($providerSku, $customerNo, $refId)
                : $this->digiflazz->buy($providerSku, $customerNo, $refId);
            $ms = (int) ((microtime(true) - $started) * 1000);
            $data = $response['data'] ?? null;

            if (!$data || !is_array($data)) {
                return ProviderFulfillmentResult::failed(
                    $ms,
                    'invalid_response',
                    !$isPasca,
                    'Invalid or empty Digiflazz response.',
                    is_array($response) ? $response : []
                );
            }

            $status = strtolower((string) ($data['status'] ?? 'pending'));
            $sn = isset($data['sn']) ? (string) $data['sn'] : null;
            $message = (string) ($data['message'] ?? $data['rc'] ?? '');
            $rcClassifier = DigiflazzResponseCodeClassifier::fromResponseData($data);
            $failureLog = DigiflazzFailureReasonPresenter::toLogContext($data);

            Log::info('Digiflazz fulfill RC classified', array_merge(
                [
                    'transaction_id' => $transaction->id,
                    'status' => $status,
                ],
                $rcClassifier->toLogContext(),
                $failureLog
            ));

            if ($status === 'success' || $status === 'sukses') {
                return ProviderFulfillmentResult::success($ms, $sn, $response, $message ?: 'OK');
            }

            if ($status === 'failed' || $status === 'gagal') {
                [$reason, $failover] = $this->classifyFailedOutcome($data, $message, $isPasca);

                Log::info('Digiflazz fulfill failure reason', array_merge(
                    [
                        'transaction_id' => $transaction->id,
                        'fulfillment_reason' => $reason,
                        'should_failover' => $failover,
                    ],
                    $failureLog
                ));

                return ProviderFulfillmentResult::failed(
                    $ms,
                    $reason,
                    $failover,
                    $message ?: 'Digiflazz reported failed.',
                    $response
                );
            }

            // pending / processing — do not failover; Digiflazz owns the ref_id
            // RC 03 / 99 are official pending classifiers when status is pending.
            return ProviderFulfillmentResult::pending(
                $ms,
                $response,
                $message ?: ($rcClassifier->isPending() ? $rcClassifier->description() : 'Processing'),
                $rcClassifier->isPending() ? 'pending' : null
            );
        } catch (\Throwable $e) {
            $ms = (int) ((microtime(true) - $started) * 1000);
            Log::warning('Digiflazz adapter fulfill error', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            $isPasca = $this->isPascaTransaction($transaction);

            return ProviderFulfillmentResult::error(
                $ms,
                $this->classifyException($e),
                !$isPasca,
                $e->getMessage()
            );
        }
    }

    /**
     * Status probe — not a new GurkyNet invoice.
     *
     * PREPAID: DigiflazzService::checkStatus() re-sends Topup with the same ref_id.
     * POSTPAID: DigiflazzService::checkStatusPasca() with commands=status-pasca.
     */
    public function checkStatus(
        Transaction $transaction,
        string $providerSku,
        string $customerNo,
        string $refId
    ): ProviderFulfillmentResult {
        $started = microtime(true);

        try {
            if (!$this->isConfigured()) {
                return ProviderFulfillmentResult::error(
                    (int) ((microtime(true) - $started) * 1000),
                    'provider_not_configured',
                    false,
                    'Digiflazz credentials are not configured.'
                );
            }

            $isPasca = $this->isPascaTransaction($transaction);

            if (! $isPasca && $this->isPrepaidStatusCheckExpired($transaction)) {
                $ms = (int) ((microtime(true) - $started) * 1000);

                return ProviderFulfillmentResult::failed(
                    $ms,
                    'status_check_window_expired',
                    false,
                    'Pengecekan status Digiflazz tidak diizinkan: transaksi prepaid lebih dari '
                        .self::PREPAID_STATUS_MAX_AGE_DAYS.' hari (risiko transaksi baru).',
                    [
                        'local' => true,
                        'reason' => 'status_check_window_expired',
                        'max_age_days' => self::PREPAID_STATUS_MAX_AGE_DAYS,
                    ]
                );
            }

            // PREPAID → re-Topup same ref_id | POSTPAID → status-pasca
            $response = $isPasca
                ? $this->digiflazz->checkStatusPasca($providerSku, $customerNo, $refId)
                : $this->digiflazz->checkStatus($providerSku, $customerNo, $refId);
            $ms = (int) ((microtime(true) - $started) * 1000);
            $data = $response['data'] ?? null;

            if (!$data || !is_array($data)) {
                return ProviderFulfillmentResult::pending($ms, is_array($response) ? $response : [], 'Status inquiry empty');
            }

            $status = strtolower((string) ($data['status'] ?? 'pending'));
            $sn = isset($data['sn']) ? (string) $data['sn'] : null;
            $message = (string) ($data['message'] ?? $data['rc'] ?? '');
            $rcClassifier = DigiflazzResponseCodeClassifier::fromResponseData($data);

            Log::info('Digiflazz status-check RC classified', array_merge(
                [
                    'transaction_id' => $transaction->id,
                    'status' => $status,
                ],
                $rcClassifier->toLogContext()
            ));

            // Postpaid >90 days: Digiflazz returns "Data belum ada" — not a system error.
            if ($isPasca && $this->isPascaDataNotFoundMessage($message)) {
                return ProviderFulfillmentResult::pending(
                    $ms,
                    $response,
                    'Data belum ada',
                    'data_not_found'
                );
            }

            if ($status === 'success' || $status === 'sukses') {
                return ProviderFulfillmentResult::success($ms, $sn, $response, $message ?: 'OK');
            }

            if ($status === 'failed' || $status === 'gagal') {
                // Status probe never failovers; RC still classifies reason (refund / validation / etc.).
                if (DigiflazzResponseCodeClassifier::normalize($data['rc'] ?? null) !== null) {
                    $reason = $this->terminalReason($rcClassifier->fulfillmentReason());
                } else {
                    [$reason] = $this->classifyFailedOutcome($data, $message, $isPasca);
                    // Force no failover on status check.
                }

                Log::info('Digiflazz status-check failure reason', array_merge(
                    [
                        'transaction_id' => $transaction->id,
                        'fulfillment_reason' => $reason,
                    ],
                    DigiflazzFailureReasonPresenter::toLogContext($data)
                ));

                return ProviderFulfillmentResult::failed(
                    $ms,
                    $reason,
                    false,
                    $message ?: 'Digiflazz reported failed.',
                    $response
                );
            }

            return ProviderFulfillmentResult::pending(
                $ms,
                $response,
                $message ?: ($rcClassifier->isPending() ? $rcClassifier->description() : 'Still processing'),
                $rcClassifier->isPending() ? 'pending' : null
            );
        } catch (\Throwable $e) {
            return ProviderFulfillmentResult::pending(
                (int) ((microtime(true) - $started) * 1000),
                ['error' => $e->getMessage()],
                'Status check error: ' . $e->getMessage()
            );
        }
    }

    protected function isPascaTransaction(Transaction $transaction): bool
    {
        $transaction->loadMissing('items');
        $meta = $transaction->items->first()?->custom_metadata ?? [];
        if (!is_array($meta)) {
            return false;
        }

        return !empty($meta['is_pasca']) || !empty($meta['inquiry_ref_id']);
    }

    protected function isPrepaidStatusCheckExpired(Transaction $transaction): bool
    {
        $createdAt = $transaction->created_at;
        if ($createdAt === null) {
            return false;
        }

        return $createdAt->lte(now()->subDays(self::PREPAID_STATUS_MAX_AGE_DAYS));
    }

    protected function isPascaDataNotFoundMessage(string $message): bool
    {
        $normalized = strtolower(trim($message));

        return $normalized !== '' && str_contains($normalized, 'data belum ada');
    }

    public function healthCheck(): array
    {
        $probe = $this->digiflazz->healthProbe();

        // DigiflazzService already returns the universal ProviderHealthProbeResult contract.
        if (isset($probe['status'], $probe['indicators'])) {
            return $probe;
        }

        return ProviderHealthProbeResult::make([
            'configured' => (bool) ($probe['configured'] ?? false),
            'connection' => $probe['connection'] ?? 'unknown',
            'authentication' => $probe['authentication'] ?? 'unknown',
            'balance' => is_string($probe['balance'] ?? null) && in_array($probe['balance'], ['ok', 'failed', 'unknown'], true)
                ? $probe['balance']
                : (($probe['balance_value'] ?? null) !== null ? 'ok' : 'unknown'),
            'service' => $probe['service'] ?? 'ok',
            'status' => $probe['status'] ?? '',
            'provider_code' => $probe['provider_code'] ?? $probe['rc'] ?? null,
            'provider_message' => $probe['provider_message'] ?? $probe['message'] ?? null,
            'http_status' => $probe['http_status'] ?? null,
            'latency_ms' => $probe['latency_ms'] ?? null,
            'balance_value' => $probe['balance_value'] ?? (is_numeric($probe['balance'] ?? null) ? $probe['balance'] : null),
            'raw' => $probe,
        ]);
    }

    /**
     * Classify a Digiflazz failed status.
     * Priority: official RC classifier → Alasan Gagal exact catalog → fuzzy catalog → unknown.
     *
     * @param  array<string, mixed>  $data
     * @return array{0: string, 1: bool} [reason, shouldFailover]
     */
    protected function classifyFailedOutcome(array $data, string $message, bool $isPasca): array
    {
        $rc = DigiflazzResponseCodeClassifier::normalize($data['rc'] ?? null);

        if ($rc !== null) {
            $classifier = DigiflazzResponseCodeClassifier::classify($rc);
            $reason = $classifier->fulfillmentReason();
            // pay-pasca ref_id is bound to Digiflazz inquiry — never failover to another provider.
            $failover = ! $isPasca && $this->failoverPolicy->shouldFailover($reason, $message, $rc);

            return [$this->terminalReason($reason, $failover), $failover];
        }

        // No RC — official Alasan Gagal catalog (exact message), then fuzzy last resort.
        $failure = DigiflazzFailureReasonCatalog::findByMessage($message)
            ?? DigiflazzFailureReasonCatalog::findByMessageFuzzy($message);

        if ($failure !== null) {
            $reason = $failure->fulfillmentReason();
            $failover = ! $isPasca && $failure->allowsFailover();

            return [$this->terminalReason($reason, $failover), $failover];
        }

        return [$this->terminalReason('provider_rejected', false), false];
    }

    /**
     * When not failing over, preserve specific terminal reasons; collapse generic provider codes.
     */
    protected function terminalReason(string $reason, bool $failover = false): string
    {
        if ($failover) {
            return $reason;
        }

        if (in_array($reason, [
            'customer_validation',
            'digiflazz_refund',
            'authentication_failure',
            'rate_limited',
            'pending',
            'unknown_configuration',
            'provider_seller_balance',
        ], true)) {
            return $reason;
        }

        return 'provider_rejected';
    }

    protected function classifyException(\Throwable $e): string
    {
        $m = strtolower($e->getMessage());
        if ($e instanceof \Illuminate\Http\Client\ConnectionException || str_contains($m, 'timeout') || str_contains($m, 'timed out')) {
            return 'timeout';
        }
        if (str_contains($m, '500') || str_contains($m, '502') || str_contains($m, '503')) {
            return 'http_5xx';
        }
        if (str_contains($m, 'not configured')) {
            return 'provider_not_configured';
        }

        return 'provider_exception';
    }
}

