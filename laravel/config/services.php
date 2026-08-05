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
        'key' => env('RESEND_KEY'),
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
    ],

    'digiflazz' => [
        'username' => env('DIGIFLAZZ_USERNAME'),
        'api_key' => env('DIGIFLAZZ_API_KEY'),
        'secret' => env('DIGIFLAZZ_SECRET'),
        'webhook_secret' => env('DIGIFLAZZ_WEBHOOK_SECRET', env('DIGIFLAZZ_SECRET')),
        'base_url' => env('DIGIFLAZZ_BASE_URL', 'https://api.digiflazz.com/v1'),
    ],

    'vip' => [
        'merchant_id' => env('VIP_MERCHANT_ID'),
        'api_key' => env('VIP_API_KEY'),
        'signature' => env('VIP_SIGNATURE'),
    ],

    'fcm' => [
        'server_key' => env('FCM_SERVER_KEY'),
        'sender_id' => env('FCM_SENDER_ID'),
    ],

    'health' => [
        'metrics_token' => env('HEALTH_METRICS_TOKEN'),
    ],
];
