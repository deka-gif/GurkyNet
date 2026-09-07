<?php

/**
 * Langganan Digital — account field schema per brand/provider.
 *
 * Priority (LanggananAccountResolver) — provider-isolated:
 *   Digi sku_schemas / VIP vip_sku_schemas
 *   → Digi desc (Digi only) / VIP note (VIP only)
 *   → brand_schemas (explicit business mappings)
 *   → UNKNOWN (never invent voucher)
 *
 * Vidio brand=voucher: explicit business fallback for non-Digi-phone SKUs
 * (VIP / legacy catalog). Digi SKUs pre33615183–86 override to phone.
 */
return [
    /**
     * DigiFlazz buyer_sku_code overrides (verified production).
     */
    'sku_schemas' => [
        'pre33615183' => [
            'delivery' => 'account',
            'fields' => [
                ['key' => 'phone', 'label' => 'Nomor HP Vidio', 'required' => true, 'input' => 'phone'],
            ],
        ],
        'pre33615184' => [
            'delivery' => 'account',
            'fields' => [
                ['key' => 'phone', 'label' => 'Nomor HP Vidio', 'required' => true, 'input' => 'phone'],
            ],
        ],
        'pre33615185' => [
            'delivery' => 'account',
            'fields' => [
                ['key' => 'phone', 'label' => 'Nomor HP Vidio', 'required' => true, 'input' => 'phone'],
            ],
        ],
        'pre33615186' => [
            'delivery' => 'account',
            'fields' => [
                ['key' => 'phone', 'label' => 'Nomor HP Vidio', 'required' => true, 'input' => 'phone'],
            ],
        ],
        'pre33615053' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
        'kvision180d' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
        'kvision30d' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
    ],

    /** VIP provider_sku overrides (empty until verified per-SKU). */
    'vip_sku_schemas' => [],

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
            // Explicit business fallback (voucher/SN) for non-Digi-phone SKUs.
            // Digi SKUs pre33615183–86 override via sku_schemas → phone.
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

    /**
     * Unmapped brands / unclear Digi desc → UNKNOWN (fail-closed).
     * Never invent voucher or account fields without evidence.
     */
    'default_delivery' => 'unknown',
    'default_fields' => [],

    /** customer_no sent to provider when delivery=voucher (Digiflazz prepaid requires a value). */
    'voucher_customer_placeholder' => 'LANGGANAN',
];
