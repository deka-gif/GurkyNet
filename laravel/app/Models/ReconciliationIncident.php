<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * SRS 18.2 — reconciliation_incidents.
 */
class ReconciliationIncident extends Model
{
    public const STATUS_OPEN = 'open';

    public const STATUS_RESOLVED = 'resolved';

    public const TYPE_INTERNAL_WALLET = 'internal_wallet';

    public const TYPE_PROVIDER_H2H = 'provider_h2h';

    public const TYPE_MIDTRANS_SETTLEMENT = 'midtrans_settlement';

    public const TYPE_BANK_MATCH = 'bank_match';

    protected $fillable = [
        'incident_code',
        'type',
        'source',
        'user_id',
        'wallet_id',
        'expected_amount',
        'actual_amount',
        'variance',
        'threshold',
        'status',
        'freeze_withdraw',
        'restrict_purchase',
        'system_wide_freeze',
        'fingerprint',
        'meta',
        'notes',
        'detected_at',
        'resolved_at',
        'resolved_by',
    ];

    protected $casts = [
        'expected_amount' => 'decimal:2',
        'actual_amount' => 'decimal:2',
        'variance' => 'decimal:2',
        'threshold' => 'decimal:2',
        'freeze_withdraw' => 'boolean',
        'restrict_purchase' => 'boolean',
        'system_wide_freeze' => 'boolean',
        'meta' => 'array',
        'detected_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }
}
