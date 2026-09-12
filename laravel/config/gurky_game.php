<?php

/**
 * Game Account Schema Registry (DigiFlazz purchase SoT).
 *
 * Resolve priority (GameAccountSchemaResolver):
 *   SKU override (with provenance)
 *   → Game Profile (verified Digi brand default)
 *   → Verified Digi provider evidence (desc parse)
 *   → UNKNOWN / NEEDS_REVIEW (not purchasable)
 *
 * VIP nickname_codes = optional get-nickname helpers ONLY — never Digi purchase schema.
 * VIP catalog products stay UNKNOWN while VIP fulfillment is OFF.
 */
return [
    /**
     * Reusable schema templates (schema_key → definition).
     * Extensible — do not treat this list as a closed enum at runtime.
     */
    'schemas' => [
        'PLAYER_ID' => [
            'schema_key' => 'PLAYER_ID',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'player_id', 'label' => 'Player ID', 'required' => true],
            ],
            'formatter' => 'single',
            'primary_key' => 'player_id',
        ],
        'UID' => [
            'schema_key' => 'UID',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'user_id', 'label' => 'UID', 'required' => true],
            ],
            'formatter' => 'single',
            'primary_key' => 'user_id',
        ],
        'USER_ID' => [
            'schema_key' => 'USER_ID',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'user_id', 'label' => 'User ID', 'required' => true],
            ],
            'formatter' => 'single',
            'primary_key' => 'user_id',
        ],
        // Ragnarok M etc. — same single Digi customer_no field, Character ID label.
        'CHARACTER_ID' => [
            'schema_key' => 'CHARACTER_ID',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'user_id', 'label' => 'Character ID', 'required' => true],
            ],
            'formatter' => 'single',
            'primary_key' => 'user_id',
        ],
        'GARENA_ID' => [
            'schema_key' => 'GARENA_ID',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'garena_id', 'label' => 'Garena ID', 'required' => true],
            ],
            'formatter' => 'single',
            'primary_key' => 'garena_id',
        ],
        'ACCOUNT_ID' => [
            'schema_key' => 'ACCOUNT_ID',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'account_id', 'label' => 'Account ID', 'required' => true],
            ],
            'formatter' => 'single',
            'primary_key' => 'account_id',
        ],
        'PHONE' => [
            'schema_key' => 'PHONE',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'phone', 'label' => 'Nomor HP', 'required' => true],
            ],
            'formatter' => 'single',
            'primary_key' => 'phone',
        ],
        'CUSTOMER_NO' => [
            'schema_key' => 'CUSTOMER_NO',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'customer_no', 'label' => 'No. Pelanggan', 'required' => true],
            ],
            'formatter' => 'single',
            'primary_key' => 'customer_no',
        ],
        'USER_ID_ZONE_ID' => [
            'schema_key' => 'USER_ID_ZONE_ID',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'user_id', 'label' => 'User ID', 'required' => true],
                ['key' => 'zone_id', 'label' => 'Zone ID', 'required' => true],
            ],
            'formatter' => 'pipe',
            'primary_key' => 'user_id',
            'secondary_key' => 'zone_id',
        ],
        'USER_ID_SERVER_ID' => [
            'schema_key' => 'USER_ID_SERVER_ID',
            'delivery' => 'account',
            'fields' => [
                ['key' => 'user_id', 'label' => 'User ID', 'required' => true],
                ['key' => 'server_id', 'label' => 'Server ID', 'required' => true],
            ],
            'formatter' => 'pipe',
            'primary_key' => 'user_id',
            'secondary_key' => 'server_id',
        ],
    ],

    /**
     * Digi Game Profiles — brand defaults with provenance.
     * New Digi SKUs under a profiled brand inherit the profile automatically.
     */
    'game_profiles' => [
        'free-fire' => [
            'schema_key' => 'PLAYER_ID',
            'label' => 'Free Fire',
            'aliases' => ['free fire', 'garena free fire', 'ff', 'freefire'],
            'provenance' => [
                'source' => 'DIGIFLAZZ_SELLER_CATALOG',
                'evidence' => 'No tujuan = player id',
                'confidence' => 'verified',
            ],
        ],
        'fc-mobile' => [
            'schema_key' => 'UID',
            'label' => 'FC Mobile',
            'aliases' => ['fc mobile', 'fcmobile', 'ea sports fc mobile', 'fifa mobile', 'fifamobile'],
            'provenance' => [
                'source' => 'DIGIFLAZZ_DESCRIPTION',
                'evidence' => 'Masukkan UID',
                'confidence' => 'verified',
            ],
        ],
        'garena' => [
            'schema_key' => 'GARENA_ID',
            'label' => 'Garena',
            'aliases' => ['garena', 'garena shell', 'voucher garena'],
            'provenance' => [
                'source' => 'DIGIFLAZZ_DESCRIPTION',
                'evidence' => 'Tujuan = ID garena',
                'confidence' => 'verified',
            ],
        ],
        'mobile-legends' => [
            'schema_key' => 'USER_ID_ZONE_ID',
            'label' => 'Mobile Legends',
            'aliases' => ['mobile legends', 'mobile legend', 'mlbb', 'ml', 'mobilelegends'],
            'provenance' => [
                'source' => 'DIGIFLAZZ_PRODUCT_DESCRIPTION',
                'evidence' => 'no pelanggan = gabungan antara user_id dan zone_id',
                'confidence' => 'verified',
            ],
        ],

        // Stage 4 — Owner research (Codashop/UniPin/GGWP) cross-checked against Digi Games SKUs.
        // Digi Voucher-category PIN SKUs under same brand names stay fail-closed via sku_overrides.
        'pubg-mobile' => [
            'schema_key' => 'USER_ID',
            'label' => 'PUBG Mobile',
            'aliases' => ['pubg mobile', 'pubg', 'pubgm', 'pubg mobile (id)', 'pubg mobile (global)'],
            'provenance' => [
                'source' => 'OWNER_RESEARCH_CROSSCHECK',
                'evidence' => 'Codashop/BuffBuff User ID; Digi Games brand SKUs are UC/pass packs (single customer_no); Digi category=Voucher UC pin SKUs excluded',
                'confidence' => 'verified',
            ],
        ],
        'arena-of-valor' => [
            'schema_key' => 'USER_ID',
            'label' => 'Arena of Valor',
            'aliases' => ['arena of valor', 'aov'],
            'provenance' => [
                'source' => 'OWNER_RESEARCH_CROSSCHECK',
                'evidence' => 'Codashop Player ID; Digi Games SKUs are AOV N Vouchers (in-game currency name, not Digi Voucher category)',
                'confidence' => 'verified',
            ],
        ],
        'call-of-duty-mobile' => [
            'schema_key' => 'USER_ID',
            'label' => 'Call of Duty Mobile',
            'aliases' => ['call of duty mobile', 'call of duty moblie', 'codm', 'cod mobile'],
            'provenance' => [
                'source' => 'OWNER_RESEARCH_CROSSCHECK',
                'evidence' => 'Codashop User ID; Digi Games SKUs are uniform CP packs',
                'confidence' => 'verified',
            ],
        ],
        'laplace-m' => [
            'schema_key' => 'USER_ID',
            'label' => 'Laplace M',
            'aliases' => ['laplace m', 'laplace'],
            'provenance' => [
                'source' => 'OWNER_RESEARCH_CROSSCHECK',
                'evidence' => 'Codashop User ID; Digi Games SKUs are Spirals packs only',
                'confidence' => 'verified',
            ],
        ],
        'ragnarok-m-eternal-love' => [
            'schema_key' => 'CHARACTER_ID',
            'label' => 'Ragnarok M: Eternal Love',
            'aliases' => [
                'ragnarok m: eternal love',
                'ragnarok m eternal love',
                'ragnarok m eternal love (sea)',
            ],
            'provenance' => [
                'source' => 'OWNER_RESEARCH_CROSSCHECK',
                'evidence' => 'Codashop Character ID / ID Char; Digi Games SKUs are Big Cat Coins packs only',
                'confidence' => 'verified',
            ],
        ],
        'speed-drifters' => [
            'schema_key' => 'USER_ID',
            'label' => 'Speed Drifters',
            'aliases' => ['speed drifters', 'speed drifter'],
            'provenance' => [
                'source' => 'OWNER_RESEARCH_CROSSCHECK',
                'evidence' => 'UniPin ID Pengguna; Digi Games SKUs are Diamonds packs (desc=-)',
                'confidence' => 'verified',
            ],
        ],
        'point-blank' => [
            'schema_key' => 'USER_ID_SERVER_ID',
            'label' => 'POINT BLANK',
            'aliases' => ['point blank'],
            'provenance' => [
                'source' => 'OWNER_RESEARCH_CROSSCHECK',
                'evidence' => 'GGWP User ID + Server; Digi Games SKUs are PB Cash packs only (no server enum in Digi — free-text server_id); Digi Voucher-category PB pin SKUs excluded',
                'confidence' => 'verified',
            ],
        ],
        // Honor of Kings: NOT activated — Digi desc has no account format; Codashop flow may be code/redeem. Fail-closed.
    ],

    /**
     * Per-SKU overrides — MUST include provenance/evidence.
     * Specific SKUs beat Game Profile.
     */
    'sku_overrides' => [
        // Explicit Digi production SKUs (same schema as profile; provenance from Digi desc).
        'pre33639303' => [
            'schema_key' => 'UID',
            'provenance' => [
                'source' => 'DIGIFLAZZ_DESCRIPTION',
                'evidence' => 'Masukkan UID',
                'confidence' => 'verified',
            ],
        ],
        'pre33639304' => [
            'schema_key' => 'UID',
            'provenance' => [
                'source' => 'DIGIFLAZZ_DESCRIPTION',
                'evidence' => 'Masukkan UID',
                'confidence' => 'verified',
            ],
        ],
        'pre33817227' => [
            'schema_key' => 'GARENA_ID',
            'provenance' => [
                'source' => 'DIGIFLAZZ_DESCRIPTION',
                'evidence' => 'Tujuan = ID garena',
                'confidence' => 'verified',
            ],
        ],
        'pre33639301' => [
            'schema_key' => 'USER_ID_ZONE_ID',
            'provenance' => [
                'source' => 'DIGIFLAZZ_PRODUCT_DESCRIPTION',
                'evidence' => 'no pelanggan = gabungan antara user_id dan zone_id',
                'confidence' => 'verified',
            ],
        ],

        // Digi active but target format not proven — NEEDS_REVIEW / not purchasable.
        'mlweek' => [
            'delivery' => 'unknown',
            'schema_key' => null,
            'fields' => [],
            'provenance' => [
                'source' => 'OWNER_REVIEW',
                'evidence' => 'desc=- ; account format not proven',
                'confidence' => 'needs_review',
            ],
        ],
        // pre33817245: Free Fire Digi diamond — inherits game_profiles PLAYER_ID (LIVE SoT).
        // Do not force UNKNOWN; profile evidence: Digi seller "No tujuan = player id".
        'pre33639299' => [
            'delivery' => 'unknown',
            'schema_key' => null,
            'fields' => [],
            'provenance' => [
                'source' => 'NON_PURCHASE',
                'evidence' => 'Cek Username utility — not top-up',
                'confidence' => 'verified',
            ],
        ],
    ],

    /**
     * Digi SKUs that are lookup/utility — not top-up purchase products.
     *
     * @var list<string>
     */
    'non_purchase_skus' => [
        'pre33639299', // Mobile Legends Cek Username
        'pre33817254', // PUBG MOBILE Cek Username
        // Digi category=Voucher PIN products miscategorized into slug=game via brand_override —
        // must NOT inherit Games direct-fill game_profiles.
        'pre33926646', // Voucher 1.200 PB Cash
        'pre33926647', // Voucher 2.400 PB Cash
        'pre33926648', // Voucher 6.000 PB Cash
        'pre33926649', // Voucher 12.000 PB Cash
        'pre33926660', // Voucher PUBG Mobile 60 UC
        'pre33926661', // Voucher PUBG Mobile 325 UC
        'pre33926662', // Voucher PUBG Mobile 660 UC
        'pre33926664', // Voucher PUBG Mobile 3850 UC
        'pre33926665', // Voucher PUBG Mobile 8100 UC
    ],

    /** VIP provider_sku overrides (empty — VIP purchase schema OFF). */
    'vip_sku_schemas' => [],

    /**
     * Explicit VIP get-nickname brand mapping (optional UX lookup only).
     * Never applied as Digi purchase schema.
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
     */
    'default_fields' => [],

    /**
     * @deprecated Use sku_overrides. Kept empty for backward-compatible config reads.
     */
    'sku_schemas' => [],
];
