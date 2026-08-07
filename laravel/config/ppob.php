<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Product Providers (PPOB SKU catalog sources)
    |--------------------------------------------------------------------------
    | These suppliers own product catalogs. Product Management filters use this
    | list only — never payment gateways.
    */
    'product_providers' => [
        'digiflazz' => [
            'code' => 'digiflazz',
            'name' => env('DIGIFLAZZ_PRODUCT_PROVIDER_NAME', 'Digiflazz'),
            'is_active' => true,
        ],
        'vip' => [
            'code' => 'vip',
            // Brand label is configurable via env / System Settings (ppob_vip_display_name).
            'name' => env('VIP_PRODUCT_PROVIDER_NAME', 'VIPAYMENT'),
            'is_active' => (bool) env('VIP_PRODUCT_PROVIDER_ENABLED', false),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Payment Gateways (top-up / settlement rails)
    |--------------------------------------------------------------------------
    | Not part of the PPOB SKU catalog. Must not appear in Product Management
    | provider filters.
    */
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

    /*
    |--------------------------------------------------------------------------
    | Transaction timeout & auto-refund
    |--------------------------------------------------------------------------
    | Pending/processing must resolve to SUCCESS or FAILED. Status is checked
    | at each check_at_seconds mark; after max_seconds a final check runs and
    | then an idempotent wallet refund is issued if still unresolved.
    |
    | Digiflazz Cek Status: do not re-call the same transaction/data with an
    | interval under 60 seconds (race / duplication risk). Offsets are clamped
    | to enforce that minimum gap.
    */
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
    | Automatic Product Provider Catalog Synchronization
    |--------------------------------------------------------------------------
    | Laravel Scheduler runs `ppob:catalog-auto-sync` daily. Digiflazz full
    | pricelist is rate-limited (~1× / 5 min / RC83) so prepaid and pasca are
    | sequenced with a cooldown before VIPayment.
    |
    | Override schedule without code changes via env (preferred) or Settings
    | keys: ppob_catalog_auto_sync_enabled, ppob_catalog_auto_sync_at.
    */
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
