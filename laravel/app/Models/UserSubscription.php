<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** FR-DIFF-02 / SRS 12.2 — Auto-Reorder subscription. */
class UserSubscription extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_PAUSED = 'paused';
    public const STATUS_CANCELED = 'canceled';

    public const MAX_RETRIES = 3;
    public const RETRY_INTERVAL_HOURS = 1;

    protected $fillable = [
        'user_id',
        'product_id',
        'target_number',
        'schedule_day',
        'status',
        'next_run_at',
        'last_run_at',
        'retry_count',
        'next_retry_at',
        'last_failure_reason',
        'last_transaction_id',
        'idempotency_seed',
    ];

    protected $casts = [
        'schedule_day' => 'integer',
        'retry_count' => 'integer',
        'next_run_at' => 'datetime',
        'last_run_at' => 'datetime',
        'next_retry_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function lastTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'last_transaction_id');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
