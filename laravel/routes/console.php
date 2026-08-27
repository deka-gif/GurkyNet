<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment('GurkyPay - Reliable PPOB Payment Solutions');
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Automatic Product Provider Catalog Sync (Sprint 6.3)
|--------------------------------------------------------------------------
| Daily Digiflazz prepaid → cooldown → Digiflazz pasca → VIPayment.
| Time/timezone/enabled are configurable via config/ppob.php (env) and
| optional Settings overrides — no JS timers; VPS cron runs schedule:run.
*/
$autoSyncAt = (string) config('ppob.catalog_auto_sync.daily_at', '23:59');
$autoSyncTz = (string) config('ppob.catalog_auto_sync.timezone', 'Asia/Jakarta');

Schedule::command('ppob:catalog-auto-sync')
    ->dailyAt($autoSyncAt)
    ->timezone($autoSyncTz)
    ->when(fn () => (bool) config('ppob.catalog_auto_sync.enabled', true))
    ->withoutOverlapping(120)
    ->runInBackground();

// Safety net: settle overdue pending/processing PPOB txs if delayed jobs were lost.
Schedule::command('transactions:reconcile-pending')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();

// Sprint 7 / SRS 18.1 — zero-loss reconciliation (Tahap 6).
Schedule::command('finance:reconcile internal')
    ->hourly()
    ->withoutOverlapping(55)
    ->runInBackground();

Schedule::command('finance:reconcile provider')
    ->dailyAt('01:15')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping(120)
    ->runInBackground();

Schedule::command('finance:reconcile midtrans')
    ->dailyAt('01:30')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping(120)
    ->runInBackground();

Schedule::command('finance:reconcile midtrans-pending')
    ->everyFifteenMinutes()
    ->withoutOverlapping(14)
    ->runInBackground();

Schedule::command('finance:reconcile closing')
    ->dailyAt('23:59')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping(120)
    ->runInBackground();

// Sprint 3 (SRS 14.1) — housekeeping only; TTL correctness never depends on this running.
Schedule::command('transactions:archive-expired-idempotency-keys')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

// FR-DIFF-01 — expire loyalty point batches (12 months)
Schedule::command('loyalty:expire-points')
    ->dailyAt('02:10')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping(120)
    ->runInBackground();

// SRS 31.4 — release pending referral commissions after hold period
Schedule::command('referral:release-commissions')
    ->dailyAt('02:20')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping(120)
    ->runInBackground();

// FR-DIFF-02 — auto-reorder due runner (skips purchase when PURCHASE_ENABLED=false)
Schedule::command('subscriptions:process-auto-reorder')
    ->everyMinute()
    ->withoutOverlapping(5)
    ->runInBackground();

// Operational hygiene
Schedule::command('queue:prune-failed --hours=168')->daily();

// Ops Command Center — scheduler heartbeat for infra monitoring
Artisan::command('ops:heartbeat', function () {
    app(\App\Services\Operations\OpsMonitoringService::class)->bumpSchedulerHeartbeat();
    $this->info('Ops scheduler heartbeat bumped.');
})->purpose('Bump ops scheduler heartbeat cache key');

Schedule::command('ops:heartbeat')->everyFiveMinutes()->withoutOverlapping();

/*
|--------------------------------------------------------------------------
| Sprint 8.5 — Integration Service scheduler (no 1s cadence)
|--------------------------------------------------------------------------
| Provider APIs only via IntegrationService. Dashboards read DB.
*/
Schedule::command('integration:sync-balances')
    ->everyTenMinutes()
    ->withoutOverlapping(15)
    ->runInBackground();

Schedule::command('integration:health-probe')
    ->everyMinute()
    ->withoutOverlapping(2)
    ->runInBackground();

Schedule::command('integration:payment-status')
    ->everyMinute()
    ->withoutOverlapping(2)
    ->runInBackground();

Schedule::command('integration:retry-failed')
    ->everyFifteenMinutes()
    ->withoutOverlapping(10)
    ->runInBackground();
