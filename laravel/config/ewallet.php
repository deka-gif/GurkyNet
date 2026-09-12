<?php

/**
 * E-Wallet (Digiflazz Pascabayar / Bebas Nominal) domain config.
 *
 * Digiflazz mirror (desc/price) does not expose authoritative min/max for
 * open-amount SKUs — limits are maintained here and returned by API so
 * mobile/web never hard-code per-brand amounts.
 */
return [

    /**
     * Canonical brand display name => open-amount limits (IDR).
     * Keys must match EwalletBrandResolver canonical names.
     */
    'open_amount_limits' => [
        'DANA' => [
            'min_amount' => 1,
            'max_amount' => 800_000,
        ],
        'GoPay' => [
            'min_amount' => 1_000,
            'max_amount' => 500_000,
        ],
        'LinkAja' => [
            'min_amount' => 1_000,
            'max_amount' => 500_000,
        ],
        'OVO' => [
            'min_amount' => 1_000,
            'max_amount' => 500_000,
        ],
        'ShopeePay' => [
            'min_amount' => 1_000,
            'max_amount' => 500_000,
        ],
    ],

];
