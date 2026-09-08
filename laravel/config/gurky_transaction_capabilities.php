<?php

/**
 * Product Transaction Capability Registry — classification layer over existing engines.
 *
 * Does NOT replace CreateTransactionAction / Digiflazz adapters.
 * Maps customer-facing category slugs → transaction mode + target schema + client support.
 */
return [
    'modes' => [
        'PREPAID_DIRECT' => [
            'inquiry_required' => false,
            'payment_required' => true,
            'provider_operation' => 'digiflazz.buy',
            'status_behavior' => 'prepaid',
            'refund_behavior' => 'fail_and_refund_pre_success',
        ],
        'POSTPAID_INQUIRY_PAYMENT' => [
            'inquiry_required' => true,
            'payment_required' => true,
            'provider_operation' => 'digiflazz.inquiry_pasca+pay_pasca',
            'status_behavior' => 'pasca_same_ref',
            'refund_behavior' => 'fail_and_refund_pre_success',
        ],
        'PLN_PREPAID_INQUIRY' => [
            'inquiry_required' => true,
            'payment_required' => true,
            'provider_operation' => 'digiflazz.pln_inquiry+buy',
            'status_behavior' => 'prepaid',
            'refund_behavior' => 'fail_and_refund_pre_success',
        ],
        'SCHEMA_ACCOUNT' => [
            'inquiry_required' => false,
            'payment_required' => true,
            'provider_operation' => 'digiflazz.buy',
            'status_behavior' => 'prepaid',
            'refund_behavior' => 'fail_and_refund_pre_success',
            'requires_resolved_account_schema' => true,
        ],
        'PHYSICAL_BATCH' => [
            'inquiry_required' => false,
            'payment_required' => true,
            'provider_operation' => 'digiflazz.buy_batch',
            'status_behavior' => 'prepaid',
            'refund_behavior' => 'fail_and_refund_pre_success',
        ],
        'DIRECT_VOUCHER' => [
            'inquiry_required' => false,
            'payment_required' => true,
            'provider_operation' => 'digiflazz.buy',
            'status_behavior' => 'prepaid',
            'refund_behavior' => 'fail_and_refund_pre_success',
        ],
        'LOOKUP_ONLY' => [
            'inquiry_required' => false,
            'payment_required' => false,
            'provider_operation' => null,
            'status_behavior' => null,
            'refund_behavior' => null,
        ],
        'INTERNAL_TRANSFER' => [
            'inquiry_required' => false,
            'payment_required' => true,
            'provider_operation' => 'wallet.transfer',
            'status_behavior' => 'internal',
            'refund_behavior' => 'ledger',
        ],
    ],

    /**
     * Per customer-facing category capability.
     * mobile_purchase / web_purchase reflect current shipped flows (not aspirational).
     */
    'categories' => [
        'pulsa' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'PHONE',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'data' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'PHONE',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'voucher-internet' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'PHONE_OR_SN',
            'mobile_purchase' => true,
            'web_purchase' => true,
            'also_supports' => ['PHYSICAL_BATCH'],
        ],
        'sms-telepon' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'PHONE',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'masa-aktif' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'PHONE',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'aktivasi-perdana' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'SERIAL',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'esim' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'PLACEHOLDER',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'pln' => [
            'mode' => 'PLN_PREPAID_INQUIRY',
            'target_schema' => 'METER_ID',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'pln-pascabayar' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'pln-nontaglis' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
            'notes' => 'Digi brand PLN NONTAGLIS — same inq-pasca + pay-pasca as other tagihan',
        ],
        'topup-digital' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'PHONE',
            'mobile_purchase' => true,
            'web_purchase' => true,
            'notes' => 'E-Wallet Digi e-money inquiry then pay with inquiry_ref_id',
        ],
        'game' => [
            'mode' => 'SCHEMA_ACCOUNT',
            'target_schema' => 'GAME_ACCOUNT',
            'mobile_purchase' => true,
            'web_purchase' => true,
            'requires_resolved_account_schema' => true,
        ],
        'langganan-digital' => [
            'mode' => 'SCHEMA_ACCOUNT',
            'target_schema' => 'LANGGANAN_ACCOUNT',
            'mobile_purchase' => true,
            'web_purchase' => true,
            'requires_resolved_account_schema' => true,
        ],
        'voucher-digital' => [
            'mode' => 'DIRECT_VOUCHER',
            'target_schema' => 'VOUCHER_LITERAL',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'international' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'PHONE_INTL',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'pdam' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'bpjs-kesehatan' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'bpjs-tk' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'internet-pascabayar' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'tv-pascabayar' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'gas' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'gas-prepaid' => [
            'mode' => 'PREPAID_DIRECT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
            'notes' => 'Digi category Gas + list_type prepaid (Pertagas/PGN nominal)',
        ],
        'pbb' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'NOP_YEAR',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'samsat' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'NOPOL_YEAR',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'multifinance' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'tagihan' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'CUSTOMER_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
        'hp-pascabayar' => [
            'mode' => 'POSTPAID_INQUIRY_PAYMENT',
            'target_schema' => 'PHONE',
            'mobile_purchase' => true,
            'web_purchase' => true,
            'notes' => 'Digi Pascabayar brand HP PASCABAYAR (Halo/XL/Tri/…)',
        ],
        'transfer' => [
            'mode' => 'INTERNAL_TRANSFER',
            'target_schema' => 'WALLET_NO',
            'mobile_purchase' => true,
            'web_purchase' => true,
        ],
    ],
];
