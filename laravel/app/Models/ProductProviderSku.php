<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductProviderSku extends Model
{
    protected $table = 'product_provider_skus';

    protected $fillable = [
        'product_id',
        'product_provider_id',
        'provider_sku',
        'provider_name',
        'base_price',
        'provider_price',
        'provider_status',
        'is_preferred',
        'is_active',
    ];

    protected $casts = [
        'base_price' => 'decimal:2',
        'provider_price' => 'decimal:2',
        'is_preferred' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productProvider(): BelongsTo
    {
        return $this->belongsTo(ProductProvider::class, 'product_provider_id');
    }
}
