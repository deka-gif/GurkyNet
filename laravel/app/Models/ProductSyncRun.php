<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductSyncRun extends Model
{
    public const STATUS_RUNNING = 'running';
    public const STATUS_SUCCESS = 'success';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'provider_code',
        'list_type',
        'triggered_by',
        'user_id',
        'started_at',
        'completed_at',
        'status',
        'fetched_count',
        'created_count',
        'updated_count',
        'deactivated_count',
        'error_count',
        'error_summary',
        'meta',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'fetched_count' => 'integer',
        'created_count' => 'integer',
        'updated_count' => 'integer',
        'deactivated_count' => 'integer',
        'error_count' => 'integer',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
