<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** FR-DIFF-01 — point ledger (earn/redeem/reverse/expire/adjust/clawback_hold). */
class LoyaltyPointLedger extends Model
{
    public const TYPE_EARN = 'earn';
    public const TYPE_REDEEM = 'redeem';
    public const TYPE_REVERSE = 'reverse';
    public const TYPE_EXPIRE = 'expire';
    public const TYPE_ADJUST = 'adjust';
    public const TYPE_CLAWBACK_HOLD = 'clawback_hold';

    protected $fillable = [
        'user_id',
        'type',
        'points',
        'remaining_points',
        'transaction_id',
        'expires_at',
        'status',
        'reference',
        'idempotency_key',
        'reason',
        'actor_id',
        'meta',
    ];

    protected $casts = [
        'points' => 'integer',
        'remaining_points' => 'integer',
        'expires_at' => 'datetime',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
