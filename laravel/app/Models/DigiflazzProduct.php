<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DigiflazzProduct extends Model
{
    use HasFactory;

    protected $fillable = [
        'buyer_sku_code',
        'product_name',
        'category',
        'brand',
        'seller_price',
        'buyer_product_status',
        'seller_product_status',
        'unlimited_stock',
        'desc',
    ];

    protected $casts = [
        'seller_price' => 'decimal:2',
        'buyer_product_status' => 'boolean',
        'seller_product_status' => 'boolean',
        'unlimited_stock' => 'boolean',
    ];
}
