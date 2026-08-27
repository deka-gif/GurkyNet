<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Sprint 7 / SRS 18.2 + 19 — reconciliation threshold
    | Default disarankan SRS: Rp50.000 (configurable via system_settings).
    |--------------------------------------------------------------------------
    */
    'recon_threshold_amount' => (float) env('FINANCE_RECON_THRESHOLD_AMOUNT', 50000),

    /** Pending Midtrans poll interval minutes (SRS 16.4: 10–15). */
    'midtrans_pending_poll_minutes' => (int) env('FINANCE_MIDTRANS_PENDING_POLL_MINUTES', 15),

    /** Age before Midtrans pending deposit is polled (SRS 16.4: >5 minutes). */
    'midtrans_pending_age_minutes' => (int) env('FINANCE_MIDTRANS_PENDING_AGE_MINUTES', 5),
];
