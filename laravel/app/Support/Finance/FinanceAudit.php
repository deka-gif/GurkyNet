<?php

namespace App\Support\Finance;

use App\Models\ActivityLog;
use App\Models\User;

/**
 * Sprint 4 — reuse ActivityLog (no second audit system).
 */
class FinanceAudit
{
    public static function log(?User $actor, string $activity, array $payload = []): void
    {
        ActivityLog::create([
            'user_id' => $actor?->id,
            'activity' => $activity,
            'payload' => $payload,
        ]);
    }
}
