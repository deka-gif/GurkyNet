<?php

namespace App\Listeners;

use App\Events\TransactionCreated;
use App\Events\TransactionSuccess;
use App\Events\TransactionFailed;
use App\Events\PaymentSettled;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AnalyticsCollector implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Handle the event.
     */
    public function handle(mixed $event): void
    {
        $date = now()->format('Y-m-d');

        if ($event instanceof TransactionCreated) {
            $this->incrementCache("metrics:{$date}:daily_transactions");
        } elseif ($event instanceof TransactionSuccess) {
            $tx = $event->transaction;
            $this->incrementCache("metrics:{$date}:daily_transactions_success");
            $this->incrementCacheBy("metrics:{$date}:daily_revenue", $tx->amount);

            // Track Success rate by Gateway / Provider
            if ($tx->payment_method === 'midtrans') {
                $this->incrementCache("metrics:{$date}:midtrans_success_count");
                $this->incrementCache("metrics:{$date}:midtrans_total_count");
            } elseif ($tx->payment_method === 'digiflazz' || !empty($tx->target_number)) {
                $this->incrementCache("metrics:{$date}:digiflazz_success_count");
                $this->incrementCache("metrics:{$date}:digiflazz_total_count");
            }
        } elseif ($event instanceof TransactionFailed) {
            $tx = $event->transaction;
            $this->incrementCache("metrics:{$date}:daily_transactions_failed");

            if ($tx->payment_method === 'midtrans') {
                $this->incrementCache("metrics:{$date}:midtrans_failed_count");
                $this->incrementCache("metrics:{$date}:midtrans_total_count");
            } elseif ($tx->payment_method === 'digiflazz' || !empty($tx->target_number)) {
                $this->incrementCache("metrics:{$date}:digiflazz_failed_count");
                $this->incrementCache("metrics:{$date}:digiflazz_total_count");
            }
        } elseif ($event instanceof PaymentSettled) {
            $tx = $event->transaction;
            $this->incrementCache("metrics:{$date}:payment_settled_count");
        }
    }

    /**
     * Helper to safely increment a cache key.
     */
    protected function incrementCache(string $key): void
    {
        try {
            if (!Cache::has($key)) {
                Cache::put($key, 1, now()->addDays(7));
            } else {
                Cache::increment($key);
            }
        } catch (\Exception $e) {
            Log::error("AnalyticsCollector: Failed to increment key '{$key}': " . $e->getMessage());
        }
    }

    /**
     * Helper to safely increment a cache key by a given value.
     */
    protected function incrementCacheBy(string $key, float $value): void
    {
        try {
            if (!Cache::has($key)) {
                Cache::put($key, $value, now()->addDays(7));
            } else {
                Cache::increment($key, (int) $value);
            }
        } catch (\Exception $e) {
            Log::error("AnalyticsCollector: Failed to increment key '{$key}' by '{$value}': " . $e->getMessage());
        }
    }
}
