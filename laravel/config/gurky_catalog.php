<?php

/**
 * GurkyNet Product Information Architecture — Product Mapping Layer.
 *
 * Provider categories (Digiflazz / VIP) are NEVER exposed to the frontend.
 * Sync + catalog filters resolve everything through this map.
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Frontend hubs (sidebar IA)
    |--------------------------------------------------------------------------
    */
    'hubs' => [
        'telekomunikasi' => [
            'label' => 'Telekomunikasi',
            'icon' => 'smartphone',
            'path' => '/dashboard/telekomunikasi',
            'children' => [
                'pulsa' => ['label' => 'Pulsa', 'path' => '/dashboard/pulsa'],
                'data' => ['label' => 'Paket Data', 'path' => '/dashboard/paket-data'],
                'voucher-internet' => ['label' => 'Voucher Internet', 'path' => '/dashboard/voucher-internet'],
                'sms-telepon' => ['label' => 'Paket SMS & Telepon', 'path' => '/dashboard/telekomunikasi/sms-telepon'],
                'masa-aktif' => ['label' => 'Masa Aktif', 'path' => '/dashboard/telekomunikasi/masa-aktif'],
                'aktivasi-perdana' => ['label' => 'Aktivasi Perdana', 'path' => '/dashboard/telekomunikasi/aktivasi-perdana'],
                'esim' => ['label' => 'eSIM', 'path' => '/dashboard/telekomunikasi/esim'],
            ],
        ],
        'pembayaran-tagihan' => [
            'label' => 'Pembayaran Tagihan',
            'icon' => 'zap',
            'path' => '/dashboard/tagihan',
            'children' => [
                'pln' => ['label' => 'Token PLN', 'path' => '/dashboard/token-pln'],
                'pln-pascabayar' => ['label' => 'PLN Pascabayar', 'path' => '/dashboard/tagihan/pln-pascabayar'],
                'pdam' => ['label' => 'PDAM', 'path' => '/dashboard/tagihan/pdam'],
                'bpjs-kesehatan' => ['label' => 'BPJS Kesehatan', 'path' => '/dashboard/tagihan/bpjs-kesehatan'],
                'bpjs-tk' => ['label' => 'BPJS Ketenagakerjaan', 'path' => '/dashboard/tagihan/bpjs-tk'],
                'internet-pascabayar' => ['label' => 'Internet Pascabayar', 'path' => '/dashboard/tagihan/internet'],
                'tv-pascabayar' => ['label' => 'TV Pascabayar', 'path' => '/dashboard/tagihan/tv'],
                'gas' => ['label' => 'Gas Negara', 'path' => '/dashboard/tagihan/gas'],
                'pbb' => ['label' => 'PBB', 'path' => '/dashboard/tagihan/pbb'],
                'samsat' => ['label' => 'SAMSAT', 'path' => '/dashboard/tagihan/samsat'],
                'multifinance' => ['label' => 'Multifinance', 'path' => '/dashboard/tagihan/multifinance'],
            ],
        ],
        'topup-digital' => [
            'label' => 'Top Up Digital',
            'icon' => 'credit-card',
            'path' => '/dashboard/topup-digital',
            'children' => [],
        ],
        'game' => [
            'label' => 'Game',
            'icon' => 'gamepad',
            'path' => '/dashboard/game',
            'children' => [],
        ],
        'voucher-digital' => [
            'label' => 'Voucher Digital',
            'icon' => 'gift',
            'path' => '/dashboard/voucher-digital',
            'children' => [],
        ],
        'langganan-digital' => [
            'label' => 'Langganan Digital',
            'icon' => 'play',
            'path' => '/dashboard/langganan-digital',
            'children' => [],
        ],
        'international' => [
            'label' => 'International Top Up',
            'icon' => 'globe',
            'path' => '/dashboard/international',
            'children' => [],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Canonical GurkyNet product category slugs (stored on products)
    |--------------------------------------------------------------------------
    */
    'categories' => [
        'pulsa' => ['name' => 'Pulsa', 'hub' => 'telekomunikasi'],
        'data' => ['name' => 'Paket Data', 'hub' => 'telekomunikasi'],
        'voucher-internet' => ['name' => 'Voucher Internet', 'hub' => 'telekomunikasi'],
        'sms-telepon' => ['name' => 'Paket SMS & Telepon', 'hub' => 'telekomunikasi'],
        'masa-aktif' => ['name' => 'Masa Aktif', 'hub' => 'telekomunikasi'],
        'aktivasi-perdana' => ['name' => 'Aktivasi Perdana', 'hub' => 'telekomunikasi'],
        'esim' => ['name' => 'eSIM', 'hub' => 'telekomunikasi'],

        'pln' => ['name' => 'Token PLN', 'hub' => 'pembayaran-tagihan'],
        'pln-pascabayar' => ['name' => 'PLN Pascabayar', 'hub' => 'pembayaran-tagihan'],
        'pdam' => ['name' => 'PDAM', 'hub' => 'pembayaran-tagihan'],
        'bpjs-kesehatan' => ['name' => 'BPJS Kesehatan', 'hub' => 'pembayaran-tagihan'],
        'bpjs-tk' => ['name' => 'BPJS Ketenagakerjaan', 'hub' => 'pembayaran-tagihan'],
        'internet-pascabayar' => ['name' => 'Internet Pascabayar', 'hub' => 'pembayaran-tagihan'],
        'tv-pascabayar' => ['name' => 'TV Pascabayar', 'hub' => 'pembayaran-tagihan'],
        'gas' => ['name' => 'Gas Negara', 'hub' => 'pembayaran-tagihan'],
        'pbb' => ['name' => 'PBB', 'hub' => 'pembayaran-tagihan'],
        'samsat' => ['name' => 'SAMSAT', 'hub' => 'pembayaran-tagihan'],
        'multifinance' => ['name' => 'Multifinance', 'hub' => 'pembayaran-tagihan'],
        'tagihan' => ['name' => 'Tagihan Lainnya', 'hub' => 'pembayaran-tagihan'],

        'topup-digital' => ['name' => 'Top Up Digital', 'hub' => 'topup-digital'],
        'ewallet' => ['name' => 'Top Up Digital', 'hub' => 'topup-digital'], // legacy alias slug

        'game' => ['name' => 'Game', 'hub' => 'game'],
        'voucher-digital' => ['name' => 'Voucher Digital', 'hub' => 'voucher-digital'],
        'voucher' => ['name' => 'Voucher Digital', 'hub' => 'voucher-digital'], // legacy
        'langganan-digital' => ['name' => 'Langganan Digital', 'hub' => 'langganan-digital'],
        'international' => ['name' => 'International Top Up', 'hub' => 'international'],
        'transfer' => ['name' => 'Transfer', 'hub' => null],
    ],

    /*
    |--------------------------------------------------------------------------
    | Digiflazz provider category → GurkyNet slug
    |--------------------------------------------------------------------------
    */
    'digiflazz_categories' => [
        'pulsa' => 'pulsa',
        'data' => 'data',
        'paket data' => 'data',
        'paket sms & telepon' => 'sms-telepon',
        'paket sms dan telepon' => 'sms-telepon',
        'masa aktif' => 'masa-aktif',
        'aktivasi perdana' => 'aktivasi-perdana',
        'esim' => 'esim',
        'e-sim' => 'esim',

        'games' => 'game',
        'game' => 'game',

        'e-money' => 'topup-digital',
        'emoney' => 'topup-digital',
        'e money' => 'topup-digital',

        'voucher' => 'voucher-digital',
        'aktivasi voucher' => 'voucher-internet',

        'streaming' => 'langganan-digital',
        'tv' => 'langganan-digital',
        'media sosial' => 'langganan-digital',
        'aplikasi' => 'langganan-digital',

        'pln' => 'pln',
        'pdam' => 'pdam',
        'bpjs kesehatan' => 'bpjs-kesehatan',
        'bpjs ketenagakerjaan' => 'bpjs-tk',
        'internet' => 'internet-pascabayar',
        'internet pascabayar' => 'internet-pascabayar',
        'tv kabel' => 'tv-pascabayar',
        'tv pascabayar' => 'tv-pascabayar',
        'gas negara' => 'gas',
        'pgn' => 'gas',
        'pbb' => 'pbb',
        'samsat' => 'samsat',
        'multifinance' => 'multifinance',
        'angsuran kredit' => 'multifinance',
        'pascabayar' => 'tagihan',

        'pulsa internasional' => 'international',
        'international' => 'international',
        'bundling' => 'data',
        'hotel' => 'tagihan',
        'gas' => 'gas',
    ],

    /*
    |--------------------------------------------------------------------------
    | VIP Payment type/category → GurkyNet slug
    |--------------------------------------------------------------------------
    */
    'vip_categories' => [
        'prepaid' => 'pulsa',
        'pulsa' => 'pulsa',
        'data' => 'data',
        'paket-data' => 'data',
        'paket-internet' => 'data',
        'internet' => 'data',
        'pln' => 'pln',
        'token-pln' => 'pln',
        'game' => 'game',
        'game-feature' => 'game',
        'games' => 'game',
        'voucher-game' => 'game',
        'topup-game' => 'game',
        'voucher' => 'voucher-digital',
        'streaming-tv' => 'langganan-digital',
        'streaming' => 'langganan-digital',
        'apps' => 'langganan-digital',
        'aplikasi' => 'langganan-digital',
        'ewallet' => 'topup-digital',
        'e-wallet' => 'topup-digital',
        'emoney' => 'topup-digital',
        'e-money' => 'topup-digital',
        'saldo-emoney' => 'topup-digital',
        'voucher-internet' => 'voucher-internet',
        'pdam' => 'pdam',
        'bpjs' => 'bpjs-kesehatan',
        'international' => 'international',
        'pulsa-internasional' => 'international',
    ],

    /*
    |--------------------------------------------------------------------------
    | Brand / product-name overrides (highest priority)
    | Prevents wrong hub placement (ML in voucher, Netflix in game, etc.)
    |--------------------------------------------------------------------------
    */
    'brand_overrides' => [
        // Telekomunikasi — must outrank generic e-wallet substring hits (e.g. "dana" inside "perdana")
        'aktivasi perdana' => 'aktivasi-perdana',
        'perdana' => 'aktivasi-perdana',
        'voucher telkomsel' => 'voucher-internet',
        'voucher axis' => 'voucher-internet',
        'voucher xl' => 'voucher-internet',
        'voucher indosat' => 'voucher-internet',
        'voucher tri' => 'voucher-internet',
        'voucher smartfren' => 'voucher-internet',
        'voucher by.u' => 'voucher-internet',
        'voucher byu' => 'voucher-internet',

        // Top Up Digital (e-wallet)
        'gopay' => 'topup-digital',
        'gojek' => 'topup-digital',
        'ovo' => 'topup-digital',
        'dana' => 'topup-digital',
        'shopeepay' => 'topup-digital',
        'shopee pay' => 'topup-digital',
        'linkaja' => 'topup-digital',
        'link aja' => 'topup-digital',
        'astrapay' => 'topup-digital',
        'grabpay' => 'topup-digital',
        'grab' => 'topup-digital',
        'maxim' => 'topup-digital',
        'isaku' => 'topup-digital',
        'sakuku' => 'topup-digital',
        'doku' => 'topup-digital',
        'paytren' => 'topup-digital',

        // Game
        'mobile legends' => 'game',
        'mobile legend' => 'game',
        'mlbb' => 'game',
        'free fire' => 'game',
        'garena free fire' => 'game',
        'pubg' => 'game',
        'pubg mobile' => 'game',
        'roblox' => 'game',
        'valorant' => 'game',
        'honor of kings' => 'game',
        'call of duty' => 'game',
        'codm' => 'game',
        'point blank' => 'game',
        'league of legends' => 'game',
        'genshin' => 'game',
        'genshin impact' => 'game',
        'arena of valor' => 'game',
        'aov' => 'game',
        'hago' => 'game',
        'higgs domino' => 'game',
        'zepeto' => 'game',
        'super sus' => 'game',
        'undawn' => 'game',
        'blood strike' => 'game',

        // Voucher Digital (gift cards / wallet codes / e-gift — NOT game diamonds)
        'google play' => 'voucher-digital',
        'google play gift card' => 'voucher-digital',
        'apple' => 'voucher-digital',
        'apple gift card' => 'voucher-digital',
        'itunes' => 'voucher-digital',
        'steam wallet' => 'voucher-digital',
        'garena shell' => 'voucher-digital',
        'razer gold' => 'voucher-digital',
        'razer' => 'voucher-digital',
        'playstation' => 'voucher-digital',
        'psn' => 'voucher-digital',
        'xbox' => 'voucher-digital',
        'unipin' => 'voucher-digital',
        'battlenet' => 'voucher-digital',
        'nintendo' => 'voucher-digital',
        'tokopedia' => 'voucher-digital',
        'alfamart' => 'voucher-digital',
        'alfamart voucher' => 'voucher-digital',
        'indomaret' => 'voucher-digital',
        'grab voucher' => 'voucher-digital',
        'map e-gift' => 'voucher-digital',
        'map egift' => 'voucher-digital',
        'map voucher' => 'voucher-digital',
        'traveloka' => 'voucher-digital',
        'traveloka e-voucher' => 'voucher-digital',
        'e-gift' => 'voucher-digital',
        'egift' => 'voucher-digital',
        'voucher belanja' => 'voucher-digital',

        // Langganan Digital (streaming / productivity subscriptions)
        'netflix' => 'langganan-digital',
        'spotify' => 'langganan-digital',
        'youtube' => 'langganan-digital',
        'youtube premium' => 'langganan-digital',
        'canva' => 'langganan-digital',
        'canva pro' => 'langganan-digital',
        'capcut' => 'langganan-digital',
        'gemini' => 'langganan-digital',
        'prime video' => 'langganan-digital',
        'amazon prime' => 'langganan-digital',
        'vision+' => 'langganan-digital',
        'vision plus' => 'langganan-digital',
        'vidio' => 'langganan-digital',
        'wetv' => 'langganan-digital',
        'viu' => 'langganan-digital',
        'iqiyi' => 'langganan-digital',
        'disney' => 'langganan-digital',
        'disney+' => 'langganan-digital',
        'chatgpt' => 'langganan-digital',
        'zoom' => 'langganan-digital',
        'microsoft 365' => 'langganan-digital',
        'office 365' => 'langganan-digital',
        'genflix' => 'langganan-digital',
        'norton' => 'langganan-digital',
        'norton 360' => 'langganan-digital',
        'apple music' => 'langganan-digital',
        'itunes music' => 'langganan-digital',

        // Tagihan brands
        'pln' => 'pln',
        'pdam' => 'pdam',
        'bpjs' => 'bpjs-kesehatan',
    ],

    /*
    |--------------------------------------------------------------------------
    | Name keyword heuristics (after brand, before provider category)
    |--------------------------------------------------------------------------
    */
    'name_keywords' => [
        'langganan-digital' => [
            'netflix', 'spotify', 'youtube premium', 'canva', 'capcut', 'vidio', 'wetv', 'viu', 'iqiyi',
            'vision+', 'prime video', 'gemini', 'genflix', 'norton', 'apple music',
        ],
        'voucher-digital' => [
            'google play', 'gift card', 'steam wallet', 'garena shell', 'razer gold', 'playstation', 'xbox', 'unipin',
            'alfamart', 'indomaret', 'tokopedia', 'traveloka', 'e-gift', 'egift', 'voucher belanja', 'map e-gift',
        ],
        'game' => ['diamond', 'diamonds', 'uc pubg', 'weekly pass', 'starlight', 'membership ml', 'ff member'],
        'topup-digital' => ['gopay', 'ovo', 'dana', 'shopeepay', 'linkaja'],
        'international' => ['internasional', 'international', 'malaysia', 'singapore', 'thailand', 'vietnam', 'philippines', 'china'],
        'voucher-internet' => ['voucher internet', 'voucher kuota', 'aktivasi voucher'],
        'sms-telepon' => [
            'sms', 'nelpon', 'telepon', 'kring', 'pronto', 'combo nelpon', 'combo sms',
            'nelpon nasional', 'nelpon sesama', 'sms nasional', 'telepon sms',
        ],
        'masa-aktif' => ['masa aktif', 'perpanjang masa', 'perpanjang aktif', 'aktif 30', 'aktif 60', 'aktif 90'],
        'aktivasi-perdana' => [
            'aktivasi perdana', 'perdana', 'aktivasi sim', 'starter pack', 'kartu perdana',
        ],
        'esim' => ['esim', 'e-sim', 'e sim'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Family aliases for GET /products?category= (includes legacy slugs)
    |--------------------------------------------------------------------------
    */
    'filter_aliases' => [
        'pulsa' => ['pulsa', 'prepaid', 'pulsa-reguler', 'pulsa-transfer'],
        'data' => ['data', 'paket-data', 'paket_data', 'paket-internet', 'paket-lainnya', 'bundling', 'internet'],
        'voucher-internet' => ['voucher-internet', 'voucher_internet', 'kuota-voucher', 'aktivasi-voucher-internet', 'voucher-kuota', 'internet-voucher', 'aktivasi-voucher'],
        'sms-telepon' => ['sms-telepon', 'paket-sms-telpon', 'paket-telepon', 'paket-sms-telepon'],
        'masa-aktif' => ['masa-aktif', 'masa_aktif'],
        'aktivasi-perdana' => ['aktivasi-perdana', 'aktivasi_perdana'],
        'esim' => ['esim', 'e-sim'],

        'pln' => ['pln', 'token-pln', 'token_pln', 'listrik'],
        'pln-pascabayar' => ['pln-pascabayar', 'pln_pascabayar'],
        'pdam' => ['pdam'],
        'bpjs-kesehatan' => ['bpjs-kesehatan', 'bpjs', 'bpjs-kes'],
        'bpjs-tk' => ['bpjs-tk', 'bpjs-ketenagakerjaan'],
        'internet-pascabayar' => ['internet-pascabayar', 'internet'],
        'tv-pascabayar' => ['tv-pascabayar', 'tv', 'tv-kabel'],
        'gas' => ['gas', 'gas-negara', 'pgn'],
        'pbb' => ['pbb'],
        'samsat' => ['samsat'],
        'multifinance' => ['multifinance', 'angsuran-kredit'],
        'tagihan' => ['tagihan', 'pascabayar', 'pdam', 'bpjs', 'bpjs-kesehatan', 'bpjs-tk', 'internet-pascabayar', 'tv-pascabayar', 'gas', 'pbb', 'samsat', 'multifinance', 'pln-pascabayar'],

        'topup-digital' => ['topup-digital', 'ewallet', 'e-wallet', 'saldo-emoney', 'emoney', 'e-money'],
        'ewallet' => ['topup-digital', 'ewallet', 'e-wallet', 'saldo-emoney', 'emoney', 'e-money'],

        'game' => ['game', 'game-feature', 'voucher-game', 'games', 'topup-game', 'top-up-game'],
        'voucher-digital' => ['voucher-digital', 'voucher', 'gift-card'],
        'voucher' => ['voucher-digital', 'voucher', 'gift-card'],
        'langganan-digital' => ['langganan-digital', 'streaming', 'streaming-tv', 'aplikasi', 'apps', 'tv'],
        'international' => ['international', 'pulsa-internasional', 'pulsa-international'],
        'transfer' => ['transfer', 'transfer-uang'],
    ],

    'unmapped_fallback' => 'pulsa',
];
