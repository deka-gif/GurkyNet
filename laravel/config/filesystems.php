<?php

return [
    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    | Absolute media / CDN base URL for Website, Android, iOS, and future object storage.
    | Example: https://cdn.gurkynet.id
    */
    'cdn_url' => env('CDN_URL'),
    'default_public_disk' => env('FILESYSTEM_PUBLIC_DISK', 'public'),

    /*
    | Path prefix used when CDN_URL is empty. Must be a Laravel API route that streams
    | public-disk files — SPA hosts often return index.html for classic /storage/*.
    */
    'media_delivery_path' => env('MEDIA_DELIVERY_PATH', '/api/v1/public/media'),

    'disks' => [
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => true,
        ],

        // Ready for future object storage / CDN origin without code changes.
        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION', 'ap-southeast-1'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
        ],
    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],
];
