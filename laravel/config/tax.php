<?php

/**
 * Sprint 18 — tax scaffold only (Bagian 22).
 * No PPN calculation until PKP/rate decided by tax consultant.
 */
return [
    'pkp_enabled' => filter_var(env('TAX_PKP_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    /** Always null by default — do not invent a rate. */
    'ppn_rate' => env('TAX_PPN_RATE', null),
];
