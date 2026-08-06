<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'product_category_id',
        'provider_id',
        'product_provider_id',
        'sku_code',
        'name',
        'base_price',
        'sell_price',
        'admin_fee',
        'status',
    ];

    protected $casts = [
        'base_price' => 'decimal:2',
        'sell_price' => 'decimal:2',
        'admin_fee' => 'decimal:2',
        'status' => 'boolean',
    ];

    /**
     * Relationship: Product belongs to a Category.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    /**
     * Relationship: Product belongs to an operator brand (Telkomsel, PLN, …).
     */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class, 'provider_id');
    }

    /**
     * Relationship: Product belongs to a Product Provider / catalog source (Digiflazz, VIP brand, …).
     */
    public function productProvider(): BelongsTo
    {
        return $this->belongsTo(ProductProvider::class, 'product_provider_id');
    }

    /**
     * Per-provider SKU offers (internal product → Digiflazz / VipPulsa SKUs).
     */
    public function providerSkus(): HasMany
    {
        return $this->hasMany(ProductProviderSku::class, 'product_id');
    }

    public function homepageFeatured(): HasMany
    {
        return $this->hasMany(HomepageFeaturedProduct::class, 'product_id');
    }
}
