<?php

/**
 * Telkomsel Paket Data UX taxonomy (master template for other operators later).
 * Classification is keyword-based on product name + Digiflazz desc — no hardcoded SKUs.
 */
return [

    'operator_keys' => ['telkomsel', 'tsel'],

    /*
    | Filter chips shown in UI (order = display order).
    | `group` null = Semua (no group filter).
    */
    'chips' => [
        ['key' => 'semua', 'label' => 'Semua', 'group' => null, 'icon' => 'all'],
        ['key' => 'favorit', 'label' => 'Favorit', 'group' => 'favorit', 'icon' => 'star'],
        ['key' => 'internet-sakti', 'label' => 'Internet Sakti', 'group' => 'internet-sakti', 'icon' => 'wifi'],
        ['key' => 'combo-sakti', 'label' => 'Combo Sakti', 'group' => 'combo-sakti', 'icon' => 'package'],
        ['key' => 'promo', 'label' => 'Promo', 'group' => 'promo', 'icon' => 'flame'],
        ['key' => 'sosial', 'label' => 'Sosial', 'group' => 'sosial', 'icon' => 'share'],
        ['key' => 'games', 'label' => 'Games', 'group' => 'games', 'icon' => 'game'],
        ['key' => 'streaming', 'label' => 'Streaming', 'group' => 'streaming', 'icon' => 'play'],
        ['key' => 'harian', 'label' => 'Harian', 'group' => 'harian', 'icon' => 'moon'],
        ['key' => 'roaming', 'label' => 'Roaming', 'group' => 'roaming', 'icon' => 'globe'],
        ['key' => 'bisnis', 'label' => 'Bisnis', 'group' => 'bisnis', 'icon' => 'briefcase'],
    ],

    /*
    | Taxonomy groups → match keywords (OR). Longer/more specific first when classifying.
    */
    'groups' => [
        'favorit' => [
            'label' => 'Favorit',
            'section' => 'favorit',
            'keywords' => [
                'combo sakti', 'internet sakti', 'super seru', 'terbaik untukmu', 'omg',
                'combo sakti', 'hotrod',
            ],
        ],
        'internet-sakti' => [
            'label' => 'Internet Sakti',
            'section' => 'favorit',
            'keywords' => ['internet sakti', 'inet sakti', 'data sakti'],
        ],
        'combo-sakti' => [
            'label' => 'Combo Sakti',
            'section' => 'favorit',
            'keywords' => ['combo sakti', 'combosakti'],
        ],
        'harian' => [
            'label' => 'Harian',
            'section' => 'harian',
            'keywords' => [
                'serba lima ribu', 'serba 5rb', 'harian', 'mingguan', 'mini', 'malam',
                'midnight', 'flash 1 hari', '1 hari', '3 hari', '7 hari',
            ],
        ],
        'sosial' => [
            'label' => 'Sosial Media',
            'section' => 'sosial',
            'keywords' => [
                'tiktok', 'youtube', 'instagram', 'facebook', 'whatsapp', 'wa ', 'sosmed', 'social',
            ],
        ],
        'streaming' => [
            'label' => 'Hiburan / Streaming',
            'section' => 'hiburan',
            'keywords' => [
                'disney', 'netflix', 'maxstream', 'videomax', 'video max', 'musicmax', 'music max',
                'viutv', 'wetv',
            ],
        ],
        'games' => [
            'label' => 'Games',
            'section' => 'hiburan',
            'keywords' => ['gamesmax', 'games max', 'games', 'mobile legends', 'free fire', 'pubg'],
        ],
        'bisnis' => [
            'label' => 'Produktivitas / Bisnis',
            'section' => 'produktivitas',
            'keywords' => [
                'belajar', 'zoom', 'orbit', 'enterprise', 'ukm', 'kerja', 'office', 'apps',
            ],
        ],
        'promo' => [
            'label' => 'Promo',
            'section' => 'promo',
            'keywords' => [
                'surprise', 'flash', 'unlimitedmax', 'unlimited max', 'premium', 'bronze', 'promo',
                'hemat',
            ],
        ],
        'roaming' => [
            'label' => 'Roaming',
            'section' => 'roaming',
            'keywords' => ['roamax', 'roa max', 'roaming', 'haji', 'umroh', 'umrah'],
        ],
        'umum' => [
            'label' => 'Umum',
            'section' => 'favorit',
            'keywords' => [],
        ],
    ],

    /*
    | Region / Area — Telkomsel often encodes area in name (Area 1/2/3).
    | Prefer auto-select via phone prefix map; only prompt user when ambiguous.
    */
    'region_required_keywords' => ['area 1', 'area 2', 'area 3', 'area1', 'area2', 'area3'],

    'region_prefix_hints' => [
        // Soft hints only — not hard product locks. Used when multiple area variants exist.
        '0811' => null,
        '0812' => null,
        '0813' => null,
        '0821' => null,
        '0822' => null,
        '0823' => null,
        '0852' => null,
        '0853' => null,
    ],
];
