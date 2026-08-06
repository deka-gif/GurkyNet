<?php

/**
 * by.U Paket Data UX taxonomy — follows Telkomsel master template pattern.
 * Classification is keyword-based on product name + Digiflazz desc — no hardcoded SKUs.
 * by.U packs are national; no region dialog by default.
 */
return [

    'operator_keys' => ['byu'],

    'display_name' => 'by.U',

    'chips' => [
        ['key' => 'semua', 'label' => 'Semua', 'group' => null],
        ['key' => 'favorit', 'label' => 'Favorit', 'group' => 'favorit'],
        ['key' => 'unlimited', 'label' => 'Unlimited', 'group' => 'unlimited'],
        ['key' => 'topping', 'label' => 'Topping', 'group' => 'topping'],
        ['key' => 'jajan', 'label' => 'Jajan', 'group' => 'jajan'],
        ['key' => 'roaming', 'label' => 'Roaming', 'group' => 'roaming'],
    ],

    'classify_priority' => [
        'roaming',
        'topping',
        'jajan',
        'unlimited',
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
        'yang bikin nagih', 'yang dicap jempol', 'super kaget', 'nagih', 'jempol',
    ],

    'badge_promo_hints' => [
        'promo', 'kaget', 'jajan', 'ggwp',
    ],

    'groups' => [
        'favorit' => [
            'label' => 'Favorit',
            'section' => 'favorit',
            'keywords' => [
                'yang bikin nagih', 'bikin nagih', 'nagih',
                'yang dicap jempol', 'dicap jempol', 'jempol',
                'super kaget', 'kaget',
            ],
        ],
        'unlimited' => [
            'label' => 'Unlimited',
            'section' => 'unlimited',
            'keywords' => [
                '1.5 mbps', '1,5 mbps', '1 mbps', '2 mbps',
                'mbps', 'unlimited',
            ],
        ],
        'topping' => [
            'label' => 'Topping',
            'section' => 'topping',
            'keywords' => [
                'tiktok', 'vidio', 'video', 'viu', 'ggwp', 'topping',
            ],
        ],
        'jajan' => [
            'label' => 'Jajan',
            'section' => 'jajan',
            'keywords' => [
                'jajan', 'receh', 'paket harian', 'harian',
            ],
        ],
        'roaming' => [
            'label' => 'Roaming',
            'section' => 'roaming',
            'keywords' => [
                'roam space', 'roamspace', 'roaming',
            ],
        ],
        'umum' => [
            'label' => 'Umum',
            'section' => 'favorit',
            'keywords' => [],
        ],
    ],

    'region_required_keywords' => [],

    'region_options' => [],

    'region_prefix_hints' => [
        '0851' => null,
    ],
];
