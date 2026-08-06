<?php

/**
 * Indosat Paket Data UX taxonomy — follows Telkomsel master template pattern.
 * Classification is keyword-based on product name + Digiflazz desc — no hardcoded SKUs.
 */
return [

    'operator_keys' => ['indosat', 'im3'],

    'display_name' => 'Indosat',

    'chips' => [
        ['key' => 'semua', 'label' => 'Semua', 'group' => null],
        ['key' => 'favorit', 'label' => 'Favorit', 'group' => 'favorit'],
        ['key' => 'freedom', 'label' => 'Freedom', 'group' => 'freedom'],
        ['key' => 'freedom-apps', 'label' => 'Freedom Apps', 'group' => 'freedom-apps'],
        ['key' => 'gift', 'label' => 'Gift', 'group' => 'gift'],
        ['key' => '5g', 'label' => '5G', 'group' => '5g'],
        ['key' => 'bisnis', 'label' => 'Bisnis', 'group' => 'bisnis'],
        ['key' => 'roaming', 'label' => 'Roaming', 'group' => 'roaming'],
    ],

    /*
    | Specific / gift / apps before broad Freedom / Favorit.
    */
    'classify_priority' => [
        'gift',
        'freedom-apps',
        '5g',
        'bisnis',
        'roaming',
        'freedom',
        'favorit',
        'umum',
    ],

    'favorit_match_groups' => [
        'favorit', 'freedom', 'umum',
    ],

    'favorit_keyword_union' => [
        'favorit', 'freedom',
    ],

    'badge_favorit_groups' => [
        'favorit', 'freedom',
    ],

    'badge_terlaris_hints' => [
        'freedom internet', 'freedom combo', 'yellow', 'freedom spesial',
    ],

    'badge_promo_hints' => [
        'promo', 'gift', 'ramadan', 'merdeka', 'fifa', 'hifi',
    ],

    'groups' => [
        'favorit' => [
            'label' => 'Favorit',
            'section' => 'favorit',
            'keywords' => [
                'freedom internet', 'freedom combo', 'yellow',
                'freedom spesial', 'freedom harian', 'freedom',
            ],
        ],
        'freedom' => [
            'label' => 'Freedom',
            'section' => 'favorit',
            'keywords' => [
                'freedom internet', 'freedom combo', 'yellow',
                'freedom spesial', 'freedom harian', 'freedom',
            ],
        ],
        'freedom-apps' => [
            'label' => 'Freedom Apps',
            'section' => 'freedom-apps',
            'keywords' => [
                'freedom u', 'freedom apps', 'freedom play', 'freedomapps',
            ],
        ],
        'gift' => [
            'label' => 'Gift',
            'section' => 'gift',
            'keywords' => [
                'freedom internet gift', 'freedom apps gift', 'freedom u gift',
                'freedom combo gift', 'yellow gift', 'extra booster gift',
                'gift data', 'gift',
            ],
        ],
        '5g' => [
            'label' => '5G & Promo',
            'section' => '5g',
            'keywords' => [
                'freedom internet 5g', 'hifi air', 'hifi',
                'ramadan', 'pure merdeka', 'merdeka',
                'fifa world cup', 'fifa', '5g',
            ],
        ],
        'bisnis' => [
            'label' => 'Bisnis',
            'section' => 'bisnis',
            'keywords' => [
                'umkmfreedom', 'umkm freedom', 'umkm',
                'freedom longlife', 'longlife',
                'satspam', 'satspam+', 'gaspol',
                'community', 'sachet', 'ekstra', 'extra',
            ],
        ],
        'roaming' => [
            'label' => 'Roaming',
            'section' => 'roaming',
            'keywords' => [
                'umroh haji internet', 'umroh haji combo', 'umroh haji',
                'istimewakita', 'istimewa kita',
                'umroh', 'umrah', 'haji', 'roaming',
            ],
        ],
        'umum' => [
            'label' => 'Umum',
            'section' => 'favorit',
            'keywords' => [],
        ],
    ],

    'region_required_keywords' => [
        'jabodetabek', 'jawa barat', 'jawa tengah', 'ejbn',
        'sumatera', 'sumatra', 'kalisumapa',
        'region', 'wilayah',
    ],

    'region_options' => [
        'Jabodetabek',
        'Jawa Barat',
        'Jawa Tengah',
        'EJBN',
        'Sumatera',
        'Kalisumapa',
    ],

    'region_prefix_hints' => [
        '0814' => null,
        '0815' => null,
        '0816' => null,
        '0855' => null,
        '0856' => null,
        '0857' => null,
        '0858' => null,
    ],
];
