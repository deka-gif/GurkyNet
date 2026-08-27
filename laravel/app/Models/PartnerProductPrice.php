<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Partner-tier sell prices — separate from agent product_prices. */
class PartnerProductPrice extends Model
{
    protected $fillable = [
        'product_id', 'partner_tier', 'sell_price', 'is_current', 'effective_from', 'updated_by',
    ];

    protected $casts = [
        'sell_price' => 'decimal:2',
        'is_current' => 'boolean',
        'effective_from' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
