<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment('GurkyPay - Reliable PPOB Payment Solutions');
})->purpose('Display an inspiring quote');

// Keep Digiflazz master catalog (prices, availability, status) synchronized hourly.
Schedule::command('digiflazz:sync')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

// Safety net: settle overdue pending/processing PPOB txs if delayed jobs were lost.
Schedule::command('transactions:reconcile-pending')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();

// Operational hygiene
Schedule::command('queue:prune-failed --hours=168')->daily();
