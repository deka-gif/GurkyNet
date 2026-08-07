<?php

namespace App\Services\ProductProviders;

/**
 * Decides whether a failed fulfillment should failover to the next Product Provider.
 * Customer-side errors must NOT failover.
 *
 * When a Digiflazz RC is provided, classification is delegated to
 * DigiflazzResponseCodeClassifier (message substring heuristics are skipped).
 */
class ProviderFailoverPolicy
{
    /**
     * Failover reasons (provider / infrastructure).
     *
     * @var list<string>
     */
    protected array $failoverReasons = [
        'timeout',
        'provider_offline',
        'offline',
        'provider_unavailable',
        'provider_maintenance',
        'maintenance',
        'api_error',
        'provider_error',
        'http_5xx',
        'auth_failed',
        'authentication_failure',
        'provider_not_configured',
        'not_configured',
        'provider_disabled',
        'invalid_response',
        'provider_exception',
        'insufficient_balance', // provider deposit / saldo — not end-user wallet
        'rate_limited',
    ];

    /**
     * Customer / business errors — stop chain, do not failover.
     * Catalog merge is unrelated: this policy only classifies fulfillment outcomes.
     *
     * @var list<string>
     */
    protected array $customerReasons = [
        'customer_validation',
        'invalid_destination',
        'invalid_number',
        'nomor_salah',
        'user_insufficient_balance',
        'duplicate_transaction',
        'digiflazz_refund',
        'provider_rejected', // hard reject when classified as customer-facing
    ];

    /**
     * Message needles that indicate a customer-side failure.
     * Used only when Digiflazz RC is absent (VIP / legacy).
     *
     * @var list<string>
     */
    protected array $customerMessageNeedles = [
        'nomor salah',
        'nomor tidak',
        'tidak terdaftar',
        'invalid number',
        'invalid msisdn',
        'wrong number',
        'customer number',
        'tujuan tidak',
        'destination',
        'duplicate',
        'transaksi ganda',
        'sudah pernah',
        'ref_id already',
        'parameter salah',
        'format salah',
        'produk tidak tersedia untuk nomor',
    ];

    /**
     * Message needles that indicate provider/infrastructure failure.
     * Used only when Digiflazz RC is absent (VIP / legacy).
     *
     * @var list<string>
     */
    protected array $failoverMessageNeedles = [
        'timeout',
        'timed out',
        'maintenance',
        'gangguan',
        'offline',
        'unavailable',
        'server',
        'internal',
        'cut off',
        'sedang gangguan',
        'saldo',
        'balance',
        'insufficient',
        'unauthorized',
        'forbidden',
        'authentication',
        'api key',
    ];

    public function shouldFailover(?string $reason, ?string $message = null, mixed $digiflazzRc = null): bool
    {
        // Digiflazz official RC takes precedence over message heuristics.
        if ($digiflazzRc !== null && $digiflazzRc !== '') {
            return DigiflazzResponseCodeClassifier::classify($digiflazzRc)->allowsFailover();
        }

        $reasonKey = strtolower(trim((string) $reason));
        $msg = strtolower(trim((string) $message));

        if ($reasonKey !== '' && in_array($reasonKey, $this->customerReasons, true)) {
            // provider_rejected alone is ambiguous — inspect message (non-Digiflazz / legacy)
            if ($reasonKey === 'provider_rejected') {
                if ($this->messageLooksCustomer($msg)) {
                    return false;
                }
                if ($this->messageLooksProvider($msg)) {
                    return true;
                }

                return false;
            }

            return false;
        }

        if ($reasonKey !== '' && in_array($reasonKey, $this->failoverReasons, true)) {
            return true;
        }

        if ($this->messageLooksCustomer($msg)) {
            return false;
        }

        if ($this->messageLooksProvider($msg)) {
            return true;
        }

        // Unknown provider failure — allow failover so secondary can try
        return $reasonKey === '' || $msg === '';
    }

    public function messageLooksCustomer(string $message): bool
    {
        foreach ($this->customerMessageNeedles as $needle) {
            if ($needle !== '' && str_contains($message, $needle)) {
                return true;
            }
        }

        return false;
    }

    public function messageLooksProvider(string $message): bool
    {
        foreach ($this->failoverMessageNeedles as $needle) {
            if ($needle !== '' && str_contains($message, $needle)) {
                return true;
            }
        }

        if (preg_match('/\b5\d{2}\b/', $message) === 1) {
            return true;
        }

        return false;
    }
}
