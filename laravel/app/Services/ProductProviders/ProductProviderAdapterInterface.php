<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;
use App\Models\Transaction;

interface ProductProviderAdapterInterface
{
    public function code(): string;

    public function isConfigured(): bool;

    /**
     * Fulfill a prepaid purchase using the provider-specific SKU (never internal SKU blindly).
     */
    public function fulfill(
        Transaction $transaction,
        string $providerSku,
        string $customerNo,
        string $refId
    ): ProviderFulfillmentResult;

    /**
     * Health probe: reachability, auth, balance, latency.
     *
     * @return array{reachable:bool,authenticated:bool,balance:?float,latency_ms:?int,message:?string}
     */
    public function healthCheck(): array;
}
