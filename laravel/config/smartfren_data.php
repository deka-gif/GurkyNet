<?php

/**
 * Smartfren Paket Data UX taxonomy — follows Telkomsel master template pattern.
 * Classification is keyword-based on product name + Digiflazz desc — no hardcoded SKUs.
 * Most Smartfren packs are national; region dialog only if SKU explicitly regional.
 */
return [

    'operator_keys' => ['smartfren', 'smart'],

    'display_name' => 'Smartfren',

    'chips' => [
        ['key' => 'semua', 'label' => 'Semua', 'group' => null],
        ['key' => 'favorit', 'label' => 'Favorit', 'group' => 'favorit'],
        ['key' => 'unlimited', 'label' => 'Unlimited', 'group' => 'unlimited'],
        ['key' => 'aplikasi', 'label' => 'Aplikasi', 'group' => 'aplikasi'],
        ['key' => 'hiburan', 'label' => 'Hiburan', 'group' => 'hiburan'],
        ['key' => 'router', 'label' => 'Router', 'group' => 'router'],
        ['key' => 'roaming', 'label' => 'Roaming', 'group' => 'roaming'],
    ],

    'classify_priority' => [
        'roaming',
        'aplikasi',
        'hiburan',
        'router',
        'unlimited',
        'favorit',
        'umum',
    ],

    'favorit_match_groups' => [
        'favorit', 'unlimited', 'umum',
    ],

    'favorit_keyword_union' => [
        'favorit', 'unlimited',
    ],

    'badge_favorit_groups' => [
        'favorit', 'unlimited',
    ],

    'badge_terlaris_hints' => [
        'unlimited nonstop', 'gokil max', 'unlimited harian',
    ],

    'badge_promo_hints' => [
        'promo', 'gokil', 'nonstop',
    ],

    'groups' => [
        'favorit' => [
            'label' => 'Favorit',
            'section' => 'favorit',
            'keywords' => [
                'unlimited harian 5g', 'unlimited nonstop 5g', 'unlimited nonstop',
                'unlimited harian', 'unlimited', 'nonstop',
                'gokil max', 'gokil', 'volume',
            ],
        ],
        'unlimited' => [
            'label' => 'Unlimited',
            'section' => 'favorit',
            'keywords' => [
                'unlimited harian 5g', 'unlimited nonstop 5g', 'unlimited nonstop',
                'unlimited harian', 'unlimited', 'nonstop',
            ],
        ],
        'aplikasi' => [
            'label' => 'Aplikasi',
            'section' => 'aplikasi',
            'keywords' => [
                'tiktok', 'youtube', 'sosmed', 'social', 'snackvideo', 'snack video',
                'chat', 'whatsapp', 'wa ',
            ],
        ],
        'hiburan' => [
            'label' => 'Hiburan',
            'section' => 'hiburan',
            'keywords' => [
                'klikfilm', 'klik film', 'nonton', 'games', 'musik', 'music', 'malam',
            ],
        ],
        'router' => [
            'label' => 'Router & Bisnis',
            'section' => 'router',
            'keywords' => [
                'connex evo', 'connex', 'mandiri', 'kuota 5g', 'kuota',
            ],
        ],
        'roaming' => [
            'label' => 'Roaming',
            'section' => 'roaming',
            'keywords' => ['roaming'],
        ],
        'umum' => [
            'label' => 'Umum',
            'section' => 'favorit',
            'keywords' => [],
        ],
    ],

    /*
    | Smartfren is mostly national — keep empty so region dialog stays hidden
    | unless a future SKU explicitly carries regional keywords.
    */
    'region_required_keywords' => [],

    'region_options' => [],

    'region_prefix_hints' => [
        '0881' => null,
        '0882' => null,
        '0883' => null,
        '0884' => null,
        '0885' => null,
        '0886' => null,
        '0887' => null,
        '0888' => null,
        '0889' => null,
    ],
];
