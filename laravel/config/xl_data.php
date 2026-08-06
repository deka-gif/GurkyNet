<?php

/**
 * XL Paket Data UX taxonomy — follows Telkomsel master template pattern.
 * Classification is keyword-based on product name + Digiflazz desc — no hardcoded SKUs.
 */
return [

    'operator_keys' => ['xl', 'axiata'],

    'display_name' => 'XL',

    'chips' => [
        ['key' => 'semua', 'label' => 'Semua', 'group' => null],
        ['key' => 'favorit', 'label' => 'Favorit', 'group' => 'favorit'],
        ['key' => 'paket-akrab', 'label' => 'Paket Akrab', 'group' => 'paket-akrab'],
        ['key' => 'xtra-combo', 'label' => 'Xtra Combo', 'group' => 'xtra-combo'],
        ['key' => 'combo-lite', 'label' => 'Combo Lite', 'group' => 'combo-lite'],
        ['key' => 'murah', 'label' => 'Murah', 'group' => 'murah'],
        ['key' => 'kuota-tambahan', 'label' => 'Kuota Tambahan', 'group' => 'kuota-tambahan'],
        ['key' => 'gift', 'label' => 'Gift', 'group' => 'gift'],
        ['key' => '5g', 'label' => '5G', 'group' => '5g'],
        ['key' => 'roaming', 'label' => 'Roaming', 'group' => 'roaming'],
    ],

    /*
    | Specific groups first, then broad favorit / umum.
    */
    'classify_priority' => [
        'paket-akrab',
        'gift',
        'combo-lite',
        '5g',
        'kuota-tambahan',
        'murah',
        'xtra-combo',
        'roaming',
        'favorit',
        'umum',
    ],

    'favorit_match_groups' => [
        'favorit', 'paket-akrab', 'xtra-combo', 'combo-lite', 'umum',
    ],

    'favorit_keyword_union' => [
        'favorit', 'paket-akrab', 'xtra-combo', 'combo-lite',
    ],

    'badge_favorit_groups' => [
        'favorit', 'paket-akrab', 'xtra-combo', 'combo-lite',
    ],

    'badge_terlaris_hints' => [
        'akrab', 'xtra combo vip', 'xtra combo plus', 'hotrod',
    ],

    'badge_promo_hints' => [
        'promo', 'gift', 'weekend', 'gacor',
    ],

    'groups' => [
        'favorit' => [
            'label' => 'Favorit',
            'section' => 'favorit',
            'keywords' => [
                'paket akrab', 'akrab',
                'xtra combo flex', 'xtra combo plus', 'xtra combo vip',
                'xtra combo', 'combo lite',
            ],
        ],
        'paket-akrab' => [
            'label' => 'Paket Akrab',
            'section' => 'favorit',
            'keywords' => ['paket akrab', 'akrab'],
        ],
        'xtra-combo' => [
            'label' => 'Xtra Combo',
            'section' => 'favorit',
            'keywords' => [
                'xtra combo flex', 'xtra combo plus', 'xtra combo vip plus',
                'xtra combo vip', 'xtra combo', 'xtracombo',
            ],
        ],
        'combo-lite' => [
            'label' => 'Combo Lite',
            'section' => 'favorit',
            'keywords' => ['combo lite', 'combolite'],
        ],
        'murah' => [
            'label' => 'Murah',
            'section' => 'murah',
            'keywords' => [
                'bebas puas', 'bebaspuas', '2rb', '3rb', '5rb', '6rb',
                'flex mini', 'xtra combo mini', 'combo mini', 'mini',
                'harian', 'bonus harian',
            ],
        ],
        'kuota-tambahan' => [
            'label' => 'Kuota Tambahan',
            'section' => 'kuota-tambahan',
            'keywords' => [
                'xtra kuota vidio', 'xtra kuota', 'kuota tambahan',
                'apps games', 'games', 'conference', 'edukasi', 'vidio',
            ],
        ],
        'gift' => [
            'label' => 'Gift',
            'section' => 'gift',
            'keywords' => [
                'grab gacor', 'gacor',
                'xtra combo gift', 'xtra combo vip gift', 'xtra combo weekend',
                'gift', 'weekend',
            ],
        ],
        '5g' => [
            'label' => '5G',
            'section' => '5g',
            'keywords' => [
                'hotrod special', 'hotrod', 'ultra 5g', '5g',
                '+one', 'plus one', 'xtra on', 'blue',
            ],
        ],
        'roaming' => [
            'label' => 'Roaming',
            'section' => 'roaming',
            'keywords' => [
                'internet umroh', 'umroh plus', 'umroh', 'umrah',
                'roaming', 'pass',
            ],
        ],
        'umum' => [
            'label' => 'Umum',
            'section' => 'favorit',
            'keywords' => [],
        ],
    ],

    'region_required_keywords' => [
        'sumatera', 'sumatra',
        'west', 'central', 'east kalsul', 'east',
        'kalsul', 'kalimantan', 'sulawesi',
        'region', 'wilayah',
    ],

    'region_options' => [
        'Sumatera',
        'West',
        'Central',
        'East',
        'East Kalsul',
    ],

    'region_prefix_hints' => [
        '0817' => null,
        '0818' => null,
        '0819' => null,
        '0859' => null,
        '0877' => null,
        '0878' => null,
    ],
];
