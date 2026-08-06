<?php

/**
 * Tri (3) Paket Data UX taxonomy — follows Telkomsel master template pattern.
 * Classification is keyword-based on product name + Digiflazz desc — no hardcoded SKUs.
 */
return [

    'operator_keys' => ['tri', 'three'],

    'display_name' => 'Tri',

    'chips' => [
        ['key' => 'semua', 'label' => 'Semua', 'group' => null],
        ['key' => 'favorit', 'label' => 'Favorit', 'group' => 'favorit'],
        ['key' => 'alwayson', 'label' => 'AlwaysOn', 'group' => 'alwayson'],
        ['key' => 'happy', 'label' => 'Happy', 'group' => 'happy'],
        ['key' => 'paket-harian', 'label' => 'Paket Harian', 'group' => 'paket-harian'],
        ['key' => 'unlimited', 'label' => 'Unlimited', 'group' => 'unlimited'],
        ['key' => 'hiburan', 'label' => 'Hiburan', 'group' => 'hiburan'],
        ['key' => 'khusus', 'label' => 'Khusus', 'group' => 'khusus'],
        ['key' => 'roaming', 'label' => 'Roaming', 'group' => 'roaming'],
    ],

    /*
    | Specific families before broad Happy / Favorit.
    */
    'classify_priority' => [
        'roaming',
        'unlimited',
        'hiburan',
        'khusus',
        'paket-harian',
        'alwayson',
        'happy',
        'favorit',
        'umum',
    ],

    'favorit_match_groups' => [
        'favorit', 'alwayson', 'happy', 'umum',
    ],

    'favorit_keyword_union' => [
        'favorit', 'alwayson', 'happy',
    ],

    'badge_favorit_groups' => [
        'favorit', 'alwayson', 'happy',
    ],

    'badge_terlaris_hints' => [
        'alwayson', 'always on', 'happy 5g', 'h3ro',
    ],

    'badge_promo_hints' => [
        'promo', 'ramadan', 'pasti untung', 'getmore',
    ],

    'groups' => [
        'favorit' => [
            'label' => 'Favorit',
            'section' => 'favorit',
            'keywords' => [
                'alwayson', 'always on',
                'happy 5g', 'happy',
                'data transfer',
            ],
        ],
        'alwayson' => [
            'label' => 'AlwaysOn',
            'section' => 'favorit',
            'keywords' => ['alwayson', 'always on', 'always-on'],
        ],
        'happy' => [
            'label' => 'Happy',
            'section' => 'favorit',
            'keywords' => ['happy 5g', 'happy'],
        ],
        'paket-harian' => [
            'label' => 'Paket Harian',
            'section' => 'paket-harian',
            'keywords' => [
                'pure 7 hari', 'pure 14 hari', 'pure 30 hari', 'pure',
                'pasti untung', 'mini',
            ],
        ],
        'unlimited' => [
            'label' => 'Unlimited',
            'section' => 'unlimited',
            'keywords' => [
                'unlimited chatting', 'unlimited sosmed', 'unlimited streaming',
                'unlimited games', 'unlimited', 'h3ro', 'hero',
            ],
        ],
        'hiburan' => [
            'label' => 'Hiburan',
            'section' => 'hiburan',
            'keywords' => [
                'getmore', 'get more', 'keepon', 'keep on',
                'happy play', 'mix', 'addon', 'add on', 'add-on',
            ],
        ],
        'khusus' => [
            'label' => 'Khusus',
            'section' => 'khusus',
            'keywords' => [
                'hifi air', 'hifi', 'sahabat ojol', 'ojol',
                'ramadan', 'kikida', 'home',
            ],
        ],
        'roaming' => [
            'label' => 'Roaming',
            'section' => 'roaming',
            'keywords' => [
                'happy travel', 'ibadah', 'roaming', 'umroh', 'umrah', 'haji',
            ],
        ],
        'umum' => [
            'label' => 'Umum',
            'section' => 'favorit',
            'keywords' => [],
        ],
    ],

    'region_required_keywords' => [
        'jakarta raya', 'jawa barat', 'jawa tengah', 'ejbn', 'lokal',
        'region', 'wilayah',
    ],

    'region_options' => [
        'Jakarta Raya',
        'Jawa Barat',
        'Jawa Tengah',
        'EJBN',
        'Lokal',
    ],

    'region_prefix_hints' => [
        '0895' => null,
        '0896' => null,
        '0897' => null,
        '0898' => null,
        '0899' => null,
    ],
];
