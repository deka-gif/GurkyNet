<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * SRS 14.1 — source of truth for request-level idempotency.
 */
class IdempotencyRequest extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'key',
        'endpoint',
        'request_hash',
        'response_snapshot',
        'status',
        'created_at',
        'completed_at',
        'archived_at',
    ];

    protected $casts = [
        'response_snapshot' => 'array',
        'created_at' => 'datetime',
        'completed_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_ARCHIVED = 'archived';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
