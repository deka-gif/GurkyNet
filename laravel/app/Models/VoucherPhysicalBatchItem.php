<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoucherPhysicalBatchItem extends Model
{
    use HasFactory;

    public const STATUS_QUEUED = 'queued';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_SUCCESS = 'success';
    public const STATUS_FAILED = 'failed';
    public const STATUS_REFUNDED = 'refunded';

    protected $fillable = [
        'batch_id',
        'serial_number',
        'status',
        'scanned_at',
        'submitted_at',
        'activated_at',
        'provider_code',
        'provider_sku',
        'provider_ref',
        'failure_reason',
        'refund_amount',
        'refunded_at',
        'retry_count',
    ];

    protected $casts = [
        'scanned_at' => 'datetime',
        'submitted_at' => 'datetime',
        'activated_at' => 'datetime',
        'refund_amount' => 'decimal:2',
        'refunded_at' => 'datetime',
        'retry_count' => 'integer',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(VoucherPhysicalBatch::class, 'batch_id');
    }
}
