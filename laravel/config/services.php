<?php

return [
    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_NOTIFICATION_CHANNEL'),
        ],
    ],

    'midtrans' => [
        'server_key' => env('MIDTRANS_SERVER_KEY'),
        'client_key' => env('MIDTRANS_CLIENT_KEY'),
        'is_production' => env('MIDTRANS_IS_PRODUCTION', false),
        'base_url' => env('MIDTRANS_BASE_URL'),
        // User-initiated Snap channels (comma-separated). Empty = all catalog channels.
        // Catalog: qris,bca_va,bni_va,bri_va,echannel,alfamart,indomaret
        'enabled_channels' => env('MIDTRANS_ENABLED_CHANNELS'),
    ],

    'payment' => [
        'default' => env('PAYMENT_GATEWAY', 'midtrans'),
    ],

    'digiflazz' => [
        'username' => env('DIGIFLAZZ_USERNAME'),
        'api_key' => env('DIGIFLAZZ_API_KEY'),
        'secret' => env('DIGIFLAZZ_SECRET'),
        'webhook_secret' => env('DIGIFLAZZ_WEBHOOK_SECRET', env('DIGIFLAZZ_SECRET')),
        'base_url' => env('DIGIFLAZZ_BASE_URL', 'https://api.digiflazz.com/v1'),
        // Optional Digiflazz Topup + Cek Tagihan / Bayar Tagihan fields — omitted from payload when unset/empty.
        'testing' => env('DIGIFLAZZ_TESTING'),
        // Customer hold/sell for official Digiflazz Development Test SKU (xld10) — ops-configured only.
        'dev_test_price' => env('DIGIFLAZZ_DEV_TEST_PRICE'),
        'max_price' => env('DIGIFLAZZ_MAX_PRICE'),
        'cb_url' => env('DIGIFLAZZ_CB_URL'),
        'allow_dot' => env('DIGIFLAZZ_ALLOW_DOT'),
    ],

    'vip' => [
        /*
         | VIP Reseller (vip-reseller.co.id) credentials.
         | Official dashboard fields: API ID + API Key.
         | Request params: key = API Key, sign = md5(API ID + API Key).
         | Production env maps API ID → VIP_MERCHANT_ID (canonical).
         */
        'base_url' => env('VIP_BASE_URL', 'https://vip-reseller.co.id/api'),
        // Canonical API ID (production)
        'merchant_id' => env('VIP_MERCHANT_ID', env('VIP_USERNAME')),
        // Alias kept for older .env samples; prefer VIP_MERCHANT_ID
        'username' => env('VIP_USERNAME', env('VIP_MERCHANT_ID')),
        'api_key' => env('VIP_API_KEY'),
        // Optional override; official formula is md5(API_ID + API_KEY)
        'signature' => env('VIP_SIGNATURE'),
    ],

    'fcm' => [
        'server_key' => env('FCM_SERVER_KEY'),
        'sender_id' => env('FCM_SENDER_ID'),
    ],

    'health' => [
        'metrics_token' => env('HEALTH_METRICS_TOKEN'),
    ],

    'frontend_url' => env('FRONTEND_URL', 'https://gurkynet.my.id'),

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', env('APP_URL', 'http://localhost') . '/api/v1/auth/google/callback'),
    ],

    'whatsapp_otp' => [
        'base_url' => env('WHATSAPP_OTP_BASE_URL'),
        'api_key' => env('WHATSAPP_OTP_API_KEY'),
        'sender_name' => env('WHATSAPP_OTP_SENDER_NAME', 'GurkyNet'),
    ],
];
