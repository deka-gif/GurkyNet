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

// Operational hygiene
Schedule::command('queue:prune-failed --hours=168')->daily();
