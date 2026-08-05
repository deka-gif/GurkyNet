<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductProviderLog extends Model
{
    protected $fillable = [
        'product_provider_id',
        'transaction_id',
        'event_type',
        'selected_provider_code',
        'fallback_provider_code',
        'reason',
        'response_time_ms',
        'attempt',
        'success',
        'error_message',
        'meta',
    ];

    protected $casts = [
        'success' => 'boolean',
        'meta' => 'array',
        'attempt' => 'integer',
        'response_time_ms' => 'integer',
    ];

    public function productProvider(): BelongsTo
    {
        return $this->belongsTo(ProductProvider::class, 'product_provider_id');
    }
}
