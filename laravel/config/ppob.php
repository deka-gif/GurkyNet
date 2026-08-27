<?php

/**
 * Sprint 10 / SRS 15 + 19 — provider HTTP + circuit breaker defaults.
 * Threshold/cooldown follow SRS 15.4 suggestion (5 failures / 5 minutes).
 */
return [
    'product_providers' => [
        'digiflazz' => [
            'code' => 'digiflazz',
            'name' => env('DIGIFLAZZ_PRODUCT_PROVIDER_NAME', 'Digiflazz'),
            'is_active' => true,
        ],
        'vip' => [
            'code' => 'vip',
            'name' => env('VIP_PRODUCT_PROVIDER_NAME', 'VIPAYMENT'),
            'is_active' => (bool) env('VIP_PRODUCT_PROVIDER_ENABLED', false),
        ],
    ],

    'payment_gateways' => [
        'midtrans' => [
            'code' => 'midtrans',
            'name' => env('MIDTRANS_DISPLAY_NAME', 'Midtrans'),
        ],
        'xendit' => [
            'code' => 'xendit',
            'name' => env('XENDIT_DISPLAY_NAME', 'Xendit'),
        ],
        'alterra' => [
            'code' => 'alterra',
            'name' => env('ALTERRA_DISPLAY_NAME', 'Alterra'),
        ],
        'artajasa' => [
            'code' => 'artajasa',
            'name' => env('ARTAJASA_DISPLAY_NAME', 'Artajasa'),
        ],
    ],

    'timeout' => [
        'max_seconds' => (int) env('PPOB_TRANSACTION_TIMEOUT_SECONDS', 180),
        'min_check_interval_seconds' => (int) env('PPOB_TRANSACTION_MIN_CHECK_INTERVAL_SECONDS', 60),
        'check_at_seconds' => array_values(array_filter(array_map(
            'intval',
            explode(',', (string) env('PPOB_TRANSACTION_TIMEOUT_CHECKS', '60,120,180'))
        ))),
    ],

    /*
    |--------------------------------------------------------------------------
    | Provider HTTP timeouts (Sprint 10 / SRS 19 — 10–15s failover window)
    |--------------------------------------------------------------------------
    */
    'provider_http' => [
        'fulfillment_timeout_seconds' => (int) env('PPOB_PROVIDER_TIMEOUT_SECONDS', 12),
        'fulfillment_connect_timeout_seconds' => (int) env('PPOB_PROVIDER_CONNECT_TIMEOUT_SECONDS', 5),
        // Keep retries low so total wall time stays inside the 10–15s NFR window.
        'fulfillment_max_retries' => (int) env('PPOB_PROVIDER_HTTP_MAX_RETRIES', 1),
        'health_timeout_seconds' => (int) env('PPOB_PROVIDER_HEALTH_TIMEOUT_SECONDS', 10),
        'catalog_timeout_seconds' => (int) env('PPOB_PROVIDER_CATALOG_TIMEOUT_SECONDS', 90),
    ],

    /*
    |--------------------------------------------------------------------------
    | Circuit breaker (Sprint 10 / SRS 15.4)
    | Suggested: 5 consecutive failures within 5 minutes → open for 5 minutes.
    |--------------------------------------------------------------------------
    */
    'circuit_breaker' => [
        'failure_threshold' => (int) env('PPOB_CB_FAILURE_THRESHOLD', 5),
        'failure_window_seconds' => (int) env('PPOB_CB_FAILURE_WINDOW_SECONDS', 300),
        'cooldown_seconds' => (int) env('PPOB_CB_COOLDOWN_SECONDS', 300),
        'half_open_successes' => (int) env('PPOB_CB_HALF_OPEN_SUCCESSES', 1),
    ],

    'catalog_auto_sync' => [
        'enabled' => (bool) env('PPOB_CATALOG_AUTO_SYNC_ENABLED', true),
        'timezone' => env('PPOB_CATALOG_AUTO_SYNC_TIMEZONE', 'Asia/Jakarta'),
        'daily_at' => env('PPOB_CATALOG_AUTO_SYNC_AT', '23:59'),
        'digiflazz_cooldown_minutes' => (int) env('PPOB_DIGIFLAZZ_SYNC_COOLDOWN_MINUTES', 5),
        'retry_delay_seconds' => (int) env('PPOB_CATALOG_SYNC_RETRY_DELAY_SECONDS', 120),
        'max_retries' => (int) env('PPOB_CATALOG_SYNC_MAX_RETRIES', 2),
        'providers' => ['digiflazz', 'vip'],
    ],
];
