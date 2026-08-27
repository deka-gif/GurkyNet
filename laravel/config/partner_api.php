<?php

/**
 * SRS Bagian 30 — Partner H2H API (Sprint 17 locked decisions).
 */
return [
    'timestamp_skew_seconds' => 300, // 5 minutes
    'default_rate_limit_per_minute' => 60,
    'webhook_retry_delays_seconds' => [60, 300, 1800], // 1m, 5m, 30m
    'webhook_max_retries' => 3,
    'auto_suspend_enabled' => false,
];
