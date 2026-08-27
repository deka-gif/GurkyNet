<?php

/**
 * SRS Bagian 31 — Referral (Sprint 16 locked params + unconfigured fraud thresholds).
 * Fraud numeric thresholds MUST stay null until Owner locks them.
 */
return [
    'pending_days' => 3,
    'level_1_percentage' => 1.0,
    'level_2_percentage' => 0.5,
    'daily_cap' => 1_000_000,
    'monthly_cap' => 10_000_000,
    'timezone' => env('APP_TIMEZONE', 'Asia/Jakarta'),

    /**
     * FR-REF-08 — all numeric thresholds intentionally NULL (unconfigured).
     * Detection may record signals; auto-block is never enabled.
     */
    'fraud' => [
        'auto_block' => false,
        'time_window_minutes' => null,
        'max_accounts_same_ip' => null,
        'max_accounts_same_device' => null,
        'small_topup_amount' => null,
        'small_topup_min_count' => null,
    ],
];
