<?php

namespace App\Services\ProductProviders;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Sprint 10 / SRS 15.4 — per-provider circuit breaker (CLOSED / OPEN / HALF_OPEN).
 * Defaults: 5 failures within 5 minutes → OPEN for 5 minutes (SRS suggestion).
 */
class ProviderCircuitBreaker
{
    public const STATE_CLOSED = 'CLOSED';

    public const STATE_OPEN = 'OPEN';

    public const STATE_HALF_OPEN = 'HALF_OPEN';

    public function state(string $providerCode): string
    {
        $data = $this->read($providerCode);
        $state = (string) ($data['state'] ?? self::STATE_CLOSED);

        if ($state === self::STATE_OPEN) {
            $openedAt = (int) ($data['opened_at'] ?? 0);
            if ($openedAt > 0 && (time() - $openedAt) >= $this->cooldownSeconds()) {
                // Transition to HALF_OPEN for a limited probe window.
                $this->write($providerCode, [
                    'state' => self::STATE_HALF_OPEN,
                    'opened_at' => $openedAt,
                    'failures' => [],
                    'half_open_probes' => 0,
                ]);

                return self::STATE_HALF_OPEN;
            }
        }

        return $state;
    }

    /**
     * Normal fulfillment only when CLOSED.
     * HALF_OPEN is reserved for limited health probes (SRS 15.4), not customer dispatch.
     */
    public function allowsFulfillment(string $providerCode): bool
    {
        return $this->state($providerCode) === self::STATE_CLOSED;
    }

    public function isOpen(string $providerCode): bool
    {
        return $this->state($providerCode) === self::STATE_OPEN;
    }

    /**
     * Record a provider/infrastructure failure (timeout, connection, unavailable).
     * Business-level customer failures must NOT call this.
     */
    public function recordFailure(string $providerCode, string $reason = 'provider_failure'): void
    {
        $state = $this->state($providerCode);
        if ($state === self::STATE_HALF_OPEN) {
            $this->tripOpen($providerCode, 'half_open_failed:'.$reason);

            return;
        }

        $data = $this->read($providerCode);
        $now = time();
        $window = $this->failureWindowSeconds();
        $failures = array_values(array_filter(
            $data['failures'] ?? [],
            static fn ($ts) => is_numeric($ts) && ($now - (int) $ts) <= $window
        ));
        $failures[] = $now;

        if (count($failures) >= $this->failureThreshold()) {
            $this->tripOpen($providerCode, $reason);

            return;
        }

        $this->write($providerCode, [
            'state' => self::STATE_CLOSED,
            'failures' => $failures,
            'opened_at' => 0,
            'half_open_probes' => 0,
        ]);
    }

    public function recordSuccess(string $providerCode): void
    {
        $state = $this->state($providerCode);
        if ($state === self::STATE_HALF_OPEN || $state === self::STATE_OPEN) {
            $this->write($providerCode, [
                'state' => self::STATE_CLOSED,
                'failures' => [],
                'opened_at' => 0,
                'half_open_probes' => 0,
            ]);
            Log::info('PROVIDER CIRCUIT CLOSED', ['provider' => $providerCode]);

            return;
        }

        // CLOSED — clear recent failures on success.
        $this->write($providerCode, [
            'state' => self::STATE_CLOSED,
            'failures' => [],
            'opened_at' => 0,
            'half_open_probes' => 0,
        ]);
    }

    /**
     * Atomic half-open probe claim — only one worker may probe.
     */
    public function tryAcquireHalfOpenProbe(string $providerCode): bool
    {
        $lock = Cache::lock($this->lockKey($providerCode), 10);
        if (! $lock->get()) {
            return false;
        }

        try {
            $state = $this->state($providerCode);
            if ($state !== self::STATE_HALF_OPEN && $state !== self::STATE_OPEN) {
                // Allow CLOSED probes freely (health).
                return $state === self::STATE_CLOSED;
            }

            if ($state === self::STATE_OPEN) {
                // Force transition check.
                $state = $this->state($providerCode);
            }

            if ($state !== self::STATE_HALF_OPEN) {
                return $state === self::STATE_CLOSED;
            }

            $data = $this->read($providerCode);
            $probes = (int) ($data['half_open_probes'] ?? 0);
            if ($probes >= 1) {
                return false;
            }

            $data['half_open_probes'] = $probes + 1;
            $data['state'] = self::STATE_HALF_OPEN;
            $this->write($providerCode, $data);

            return true;
        } finally {
            optional($lock)->release();
        }
    }

    public function forceOpen(string $providerCode, string $reason = 'forced'): void
    {
        $this->tripOpen($providerCode, $reason);
    }

    public function reset(string $providerCode): void
    {
        Cache::forget($this->cacheKey($providerCode));
    }

    protected function tripOpen(string $providerCode, string $reason): void
    {
        $this->write($providerCode, [
            'state' => self::STATE_OPEN,
            'failures' => [],
            'opened_at' => time(),
            'half_open_probes' => 0,
            'reason' => $reason,
        ]);
        Log::warning('PROVIDER CIRCUIT OPEN', [
            'provider' => $providerCode,
            'reason' => $reason,
            'cooldown_seconds' => $this->cooldownSeconds(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function read(string $providerCode): array
    {
        $raw = Cache::get($this->cacheKey($providerCode), []);

        return is_array($raw) ? $raw : [];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function write(string $providerCode, array $data): void
    {
        Cache::put($this->cacheKey($providerCode), $data, $this->cooldownSeconds() + $this->failureWindowSeconds() + 60);
    }

    protected function cacheKey(string $providerCode): string
    {
        return 'ppob:circuit:'.strtolower($providerCode);
    }

    protected function lockKey(string $providerCode): string
    {
        return 'ppob:circuit:lock:'.strtolower($providerCode);
    }

    protected function failureThreshold(): int
    {
        return max(1, (int) config('ppob.circuit_breaker.failure_threshold', 5));
    }

    protected function failureWindowSeconds(): int
    {
        return max(30, (int) config('ppob.circuit_breaker.failure_window_seconds', 300));
    }

    protected function cooldownSeconds(): int
    {
        return max(30, (int) config('ppob.circuit_breaker.cooldown_seconds', 300));
    }
}
