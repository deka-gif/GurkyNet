<?php

/**
 * Sprint 18 — SRS Bagian 23 SLA targets (literal). Do not invent new numbers.
 * Business hours are an abstraction; calendar policy still needs Owner confirmation.
 */
return [
    'timezone' => env('SLA_TIMEZONE', 'Asia/Jakarta'),

    /** Tentative business hours — FINDING: not specified in SRS; config-only. */
    'business_hours' => [
        'start' => env('SLA_BUSINESS_HOUR_START', '09:00'),
        'end' => env('SLA_BUSINESS_HOUR_END', '17:00'),
        'weekdays' => [1, 2, 3, 4, 5], // Mon–Fri (ISO-8601)
    ],

    'targets' => [
        // Live Chat first response during operational hours
        'live_chat_first_response_seconds' => 5 * 60,
        // Technical light ticket resolution
        'technical_ticket_seconds' => 24 * 60 * 60,
        // Funds/balance after Finance escalation
        'funds_ticket_seconds' => 2 * 24 * 60 * 60,
        // Manual deposit approve/reject
        'deposit_within_hours_seconds' => 30 * 60,
        'deposit_outside_hours_seconds' => 3 * 60 * 60,
        // Withdraw
        'withdraw_normal_seconds' => 24 * 60 * 60,
        'withdraw_large_owner_seconds' => 2 * 24 * 60 * 60,
    ],

    /** Amount above which withdraw uses Owner-tier SLA (config; SRS says "nominal besar"). */
    'withdraw_large_threshold' => (float) env('SLA_WITHDRAW_LARGE_THRESHOLD', 10000000),

    /** Fraction of deadline remaining below which status becomes nearing. */
    'nearing_ratio' => 0.2,
];
