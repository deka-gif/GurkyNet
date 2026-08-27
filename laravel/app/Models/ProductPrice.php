<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FR-DIFF-03 / SRS 7.4 — tiered sell price per agent_level (display/calc; checkout not wired in Sprint 15).
 */
class ProductPrice extends Model
{
    protected $fillable = [
        'product_id',
        'agent_level',
        'sell_price',
        'effective_from',
        'is_current',
    ];

    protected $casts = [
        'sell_price' => 'decimal:2',
        'effective_from' => 'datetime',
        'is_current' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
