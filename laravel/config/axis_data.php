<?php

/**
 * AXIS Paket Data UX taxonomy — follows Telkomsel master template pattern.
 * Classification is keyword-based on product name + Digiflazz desc — no hardcoded SKUs.
 */
return [

    'operator_keys' => ['axis'],

    'display_name' => 'AXIS',

    'chips' => [
        ['key' => 'semua', 'label' => 'Semua', 'group' => null],
        ['key' => 'favorit', 'label' => 'Favorit', 'group' => 'favorit'],
        ['key' => 'warnet', 'label' => 'Warnet', 'group' => 'warnet'],
        ['key' => 'aplikasi', 'label' => 'Aplikasi', 'group' => 'aplikasi'],
        ['key' => 'hiburan', 'label' => 'Hiburan', 'group' => 'hiburan'],
        ['key' => 'produktivitas', 'label' => 'Produktivitas', 'group' => 'produktivitas'],
        ['key' => 'umroh', 'label' => 'Umroh', 'group' => 'umroh'],
    ],

    'classify_priority' => [
        'umroh',
        'aplikasi',
        'hiburan',
        'produktivitas',
        'warnet',
        'favorit',
        'umum',
    ],

    'favorit_match_groups' => [
        'favorit', 'umum',
    ],

    'favorit_keyword_union' => [
        'favorit',
    ],

    'badge_favorit_groups' => [
        'favorit',
    ],

    'badge_terlaris_hints' => [
        'bronet', 'aigo unlimited', 'aigo ss', 'aigo',
    ],

    'badge_promo_hints' => [
        'promo', 'ekstra', 'bagi kuota', 'pure',
    ],

    'groups' => [
        'favorit' => [
            'label' => 'Favorit',
            'section' => 'favorit',
            'keywords' => [
                'bronet go', 'bronet 5g', 'bronet',
                'aigo unlimited', 'aigo ss', 'aigo',
                'bagi kuota', 'pure', 'ekstra', 'extra',
            ],
        ],
        'warnet' => [
            'label' => 'Warnet',
            'section' => 'warnet',
            'keywords' => [
                'paket warnet', 'warnet', 'harian', 'mini',
            ],
        ],
        'aplikasi' => [
            'label' => 'Aplikasi',
            'section' => 'aplikasi',
            'keywords' => [
                'kzl chat', 'kzl sosmed', 'kzl musik', 'kzl',
                'bronet sosmed', 'youtube', 'sosmed', 'social', 'musik', 'music',
            ],
        ],
        'hiburan' => [
            'label' => 'Hiburan',
            'section' => 'hiburan',
            'keywords' => [
                'drp games', 'apps games', 'bronet vidio', 'bronet video',
                'games', 'viu', 'vidio', 'video', 'komik', 'boy',
            ],
        ],
        'produktivitas' => [
            'label' => 'Produktivitas',
            'section' => 'produktivitas',
            'keywords' => [
                'edu conference', 'edukasi', 'edu', 'sunset', 'obor',
            ],
        ],
        'umroh' => [
            'label' => 'Umroh',
            'section' => 'umroh',
            'keywords' => [
                'combo mabrur', 'mabrur', 'umroh', 'umrah', 'haji',
            ],
        ],
        'umum' => [
            'label' => 'Umum',
            'section' => 'favorit',
            'keywords' => [],
        ],
    ],

    'region_required_keywords' => [
        'jawa timur', 'jawa bali nusra', 'non jawa bali nusra', 'non jawa',
        'sukabumi', 'semarang-salatiga', 'semarang salatiga', 'salatiga jatim',
        'salatiga', 'kendal',
        'banyuwangi probolinggo', 'banyuwangi', 'probolinggo',
        'madura sidoarjo malang sumbawa', 'madura', 'sidoarjo',
        'sulawesi ewako', 'ewako', 'sulutra', 'ntt',
        'jawa bali', 'sulawesi',
        'region', 'wilayah',
    ],

    'region_options' => [
        'Jawa Timur',
        'Jawa Bali Nusra',
        'Non Jawa Bali Nusra',
        'Sukabumi',
        'Semarang-Salatiga',
        'Salatiga',
        'Kendal',
        'Banyuwangi Probolinggo',
        'Madura Sidoarjo Malang Sumbawa',
        'Salatiga Jatim Sulawesi',
        'Sulawesi Ewako',
        'Sulutra',
        'NTT',
    ],

    'region_prefix_hints' => [
        '0831' => null,
        '0832' => null,
        '0833' => null,
        '0838' => null,
    ],
];
