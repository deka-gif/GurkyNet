<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VoucherPhysicalBatch extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_COMPLETED_WITH_FAILURES = 'completed_with_failures';

    protected $fillable = [
        'transaction_id',
        'user_id',
        'product_id',
        'sku_code',
        'operator_name',
        'quota_label',
        'unit_price',
        'total_serials',
        'success_count',
        'failed_count',
        'refunded_count',
        'status',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'total_serials' => 'integer',
        'success_count' => 'integer',
        'failed_count' => 'integer',
        'refunded_count' => 'integer',
    ];

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(VoucherPhysicalBatchItem::class, 'batch_id');
    }
}
