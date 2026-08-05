<?php

namespace App\Services\ProductProviders;

/**
 * Result of a single product-provider fulfillment attempt.
 * Frontend never sees provider identity — only transaction status.
 */
final class ProviderFulfillmentResult
{
    public function __construct(
        public readonly bool $ok,
        public readonly string $status, // success|failed|pending|error
        public readonly bool $shouldFailover,
        public readonly int $responseTimeMs,
        public readonly ?string $sn = null,
        public readonly ?string $message = null,
        public readonly ?string $reason = null,
        public readonly array $raw = [],
    ) {}

    public static function success(int $ms, ?string $sn, array $raw = [], ?string $message = null): self
    {
        return new self(true, 'success', false, $ms, $sn, $message, null, $raw);
    }

    public static function pending(int $ms, array $raw = [], ?string $message = null): self
    {
        return new self(true, 'pending', false, $ms, null, $message, null, $raw);
    }

    public static function failed(int $ms, string $reason, bool $failover, ?string $message = null, array $raw = []): self
    {
        return new self(false, 'failed', $failover, $ms, null, $message, $reason, $raw);
    }

    public static function error(int $ms, string $reason, bool $failover = true, ?string $message = null): self
    {
        return new self(false, 'error', $failover, $ms, null, $message ?? $reason, $reason, []);
    }
}
