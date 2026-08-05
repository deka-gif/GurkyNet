<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'health', 'status', 'metrics'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env(
            'CORS_ALLOWED_ORIGINS',
            'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173'
        ))
    ))),

    'allowed_origins_patterns' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ALLOWED_ORIGIN_PATTERNS', ''))
    ))),

    'allowed_headers' => ['*'],

    'exposed_headers' => ['X-Request-Id', 'X-API-Version'],

    'max_age' => (int) env('CORS_MAX_AGE', 600),

    'supports_credentials' => true,
];
