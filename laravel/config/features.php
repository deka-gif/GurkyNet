<?php

/**
 * Sprint 8 — public User/Agen transaction go-live gates.
 * SRS Bagian 20 Tahap 3 + .cursorrules #8: purchase/withdraw must stay off
 * until explicit production confirmation.
 */
return [
    'purchase_enabled' => filter_var(env('PURCHASE_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    /** FR-KYC-01 — when true, Tier 1 (phone + email verified) required before wallet purchase. */
    'purchase_kyc_required' => filter_var(env('PURCHASE_KYC_REQUIRED', true), FILTER_VALIDATE_BOOLEAN),
    'withdraw_enabled' => filter_var(env('WITHDRAW_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    /** Recurring/automatic top-up scheduler only — NOT user-initiated Midtrans top-up. */
    'auto_topup_enabled' => filter_var(env('AUTO_TOPUP_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    /** SRS 30 — Partner H2H API production gate (separate from User PURCHASE_ENABLED). */
    'partner_api_enabled' => filter_var(env('PARTNER_API_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'partner_api_sandbox_enabled' => filter_var(env('PARTNER_API_SANDBOX_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
];
