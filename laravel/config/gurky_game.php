<?php

/**
 * Game account / nickname mapping for VIP Payment get-nickname.
 *
 * Resolve priority (GameNicknameResolver) — provider-isolated:
 *   sku_schemas (Digi) / vip_sku_schemas (VIP)
 *   → Digiflazz desc (Digi only) / VIP note (VIP only)
 *   → nickname_codes (VIP brand / get-nickname — NOT Digi category heuristic)
 *   → UNKNOWN
 *
 * Digi products without clear Digi evidence do NOT inherit VIP brand fields.
 */
return [
    /**
     * DigiFlazz buyer_sku_code overrides (verified production).
     * Free Fire Digi diamond-only SKUs → unknown (desc does not prove player_id).
     */
    'sku_schemas' => [
        'mlweek' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
        'pre33639299' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
        'ff12' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
        'ff50' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
        'ff140' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
        'ff355' => [
            'delivery' => 'unknown',
            'fields' => [],
        ],
    ],

    /** VIP provider_sku / VIP-{code} overrides (empty until verified per-SKU). */
    'vip_sku_schemas' => [],

    /**
     * Explicit VIP get-nickname brand mapping (not Digi category heuristic).
     * Free Fire → player_id is VIP nickname API mapping, applied only for VIP /
     * brand-only resolve — never as Digi default when Digi desc is unclear.
     */
    'nickname_codes' => [
        'mobile-legends' => [
            'label' => 'Mobile Legends',
            'aliases' => ['mobile legends', 'mobile legend', 'mlbb', 'ml', 'mobilelegends'],
            'fields' => [
                ['key' => 'user_id', 'label' => 'User ID', 'required' => true],
                ['key' => 'zone_id', 'label' => 'Zone ID', 'required' => true],
            ],
        ],
        'free-fire' => [
            'label' => 'Free Fire',
            'aliases' => ['free fire', 'garena free fire', 'ff', 'freefire'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'fc-mobile' => [
            'label' => 'FC Mobile',
            'aliases' => ['fc mobile', 'fcmobile', 'ea sports fc mobile', 'fifa mobile', 'fifamobile'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID / EA ID', 'required' => true],
            ],
        ],
        'pubg' => [
            'label' => 'PUBG Mobile',
            'aliases' => ['pubg', 'pubg mobile', 'pubgm'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'valorant' => [
            'label' => 'Valorant',
            'aliases' => ['valorant'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Riot ID', 'required' => true],
            ],
        ],
        'genshin-impact' => [
            'label' => 'Genshin Impact',
            'aliases' => ['genshin', 'genshin impact'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'UID', 'required' => true],
            ],
        ],
        'honkai-impact' => [
            'label' => 'Honkai Impact 3',
            'aliases' => ['honkai', 'honkai impact', 'honkai impact 3'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'honkaistarrail' => [
            'label' => 'Honkai Star Rail',
            'aliases' => ['honkai star rail', 'hsr', 'star rail'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'UID', 'required' => true],
            ],
        ],
        'callofduty' => [
            'label' => 'Call of Duty Mobile',
            'aliases' => ['call of duty', 'codm', 'call of duty mobile'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'point-blank' => [
            'label' => 'Point Blank',
            'aliases' => ['point blank', 'pb'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'aov' => [
            'label' => 'Arena of Valor',
            'aliases' => ['arena of valor', 'aov'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'hago' => [
            'label' => 'Hago',
            'aliases' => ['hago'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'higgs-domino' => [
            'label' => 'Higgs Domino',
            'aliases' => ['higgs domino', 'higgs'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'supersus' => [
            'label' => 'Super Sus',
            'aliases' => ['super sus', 'supersus'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'garena-undawn' => [
            'label' => 'Garena Undawn',
            'aliases' => ['undawn', 'garena undawn'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'wild-rift' => [
            'label' => 'Wild Rift',
            'aliases' => ['wild rift', 'lol wild rift'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'ragnarokm' => [
            'label' => 'Ragnarok M',
            'aliases' => ['ragnarok m', 'ragnarok mobile'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
                ['key' => 'zone_id', 'label' => 'Server ID', 'required' => true],
            ],
        ],
        'life-after' => [
            'label' => 'Life After',
            'aliases' => ['life after'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
        'sausageman' => [
            'label' => 'Sausage Man',
            'aliases' => ['sausage man', 'sausageman'],
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
        ],
    ],

    /**
     * @deprecated Unused — unknown brands return delivery=unknown (fail-closed).
     * Kept empty so accidental reads never invent player_id.
     */
    'default_fields' => [],
];
