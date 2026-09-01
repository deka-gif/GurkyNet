<?php

/**
 * Langganan Digital — account field schema per brand/provider.
 * delivery=voucher → no customer input; provider returns SN/code after payment.
 * delivery=account → user must fill fields; values compose customer_no for Digiflazz/VIP.
 */
return [
    /** Per-SKU overrides (buyer_sku_code) — takes priority over brand schema. */
    'sku_schemas' => [
        // 'NFLX30' => [
        //     'delivery' => 'account',
        //     'fields' => [
        //         ['key' => 'email', 'label' => 'Email Akun Netflix', 'required' => true, 'input' => 'email'],
        //     ],
        // ],
    ],

    'brand_schemas' => [
        'netflix' => [
            'label' => 'Netflix',
            'aliases' => ['netflix'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun Netflix', 'required' => true, 'input' => 'email'],
            ],
        ],
        'spotify' => [
            'label' => 'Spotify',
            'aliases' => ['spotify'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun Spotify', 'required' => true, 'input' => 'email'],
            ],
        ],
        'youtube' => [
            'label' => 'YouTube Premium',
            'aliases' => ['youtube', 'youtube premium'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Google / Gmail', 'required' => true, 'input' => 'email'],
            ],
        ],
        'canva' => [
            'label' => 'Canva Pro',
            'aliases' => ['canva', 'canva pro'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun Canva', 'required' => true, 'input' => 'email'],
            ],
        ],
        'disney' => [
            'label' => 'Disney+',
            'aliases' => ['disney', 'disney+', 'disney plus'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun Disney+', 'required' => true, 'input' => 'email'],
            ],
        ],
        'chatgpt' => [
            'label' => 'ChatGPT',
            'aliases' => ['chatgpt', 'chat gpt', 'openai'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun OpenAI', 'required' => true, 'input' => 'email'],
            ],
        ],
        'zoom' => [
            'label' => 'Zoom',
            'aliases' => ['zoom'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun Zoom', 'required' => true, 'input' => 'email'],
            ],
        ],
        'microsoft-365' => [
            'label' => 'Microsoft 365',
            'aliases' => ['microsoft 365', 'office 365', 'microsoft365'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun Microsoft', 'required' => true, 'input' => 'email'],
            ],
        ],
        'norton' => [
            'label' => 'Norton',
            'aliases' => ['norton', 'norton 360'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun Norton', 'required' => true, 'input' => 'email'],
            ],
        ],
        'apple-music' => [
            'label' => 'Apple Music',
            'aliases' => ['apple music', 'itunes music'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Apple ID / Email', 'required' => true, 'input' => 'email'],
            ],
        ],
        'prime-video' => [
            'label' => 'Prime Video',
            'aliases' => ['prime video', 'amazon prime'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun Amazon', 'required' => true, 'input' => 'email'],
            ],
        ],
        'gemini' => [
            'label' => 'Gemini',
            'aliases' => ['gemini', 'google gemini'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Google / Gmail', 'required' => true, 'input' => 'email'],
            ],
        ],
        'capcut' => [
            'label' => 'CapCut',
            'aliases' => ['capcut'],
            'delivery' => 'account',
            'fields' => [
                ['key' => 'email', 'label' => 'Email Akun CapCut', 'required' => true, 'input' => 'email'],
            ],
        ],
        'vidio' => [
            'label' => 'Vidio',
            'aliases' => ['vidio'],
            'delivery' => 'voucher',
            'fields' => [],
        ],
        'wetv' => [
            'label' => 'WeTV',
            'aliases' => ['wetv', 'we tv'],
            'delivery' => 'voucher',
            'fields' => [],
        ],
        'viu' => [
            'label' => 'Viu',
            'aliases' => ['viu'],
            'delivery' => 'voucher',
            'fields' => [],
        ],
        'iqiyi' => [
            'label' => 'iQIYI',
            'aliases' => ['iqiyi'],
            'delivery' => 'voucher',
            'fields' => [],
        ],
        'vision-plus' => [
            'label' => 'Vision+',
            'aliases' => ['vision+', 'vision plus'],
            'delivery' => 'voucher',
            'fields' => [],
        ],
        'genflix' => [
            'label' => 'Genflix',
            'aliases' => ['genflix'],
            'delivery' => 'voucher',
            'fields' => [],
        ],
    ],

    /** Unmapped brands default to voucher delivery (code via SN, no account input). */
    'default_delivery' => 'voucher',
    'default_fields' => [],

    /** customer_no sent to provider when delivery=voucher (Digiflazz prepaid requires a value). */
    'voucher_customer_placeholder' => 'LANGGANAN',
];
