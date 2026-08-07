<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DigiflazzProduct extends Model
{
    use HasFactory;

    protected $fillable = [
        'buyer_sku_code',
        'list_type',
        'product_name',
        'category',
        'brand',
        'type',
        'seller_name',
        'seller_price',
        'admin',
        'commission',
        'buyer_product_status',
        'seller_product_status',
        'unlimited_stock',
        'stock',
        'multi',
        'start_cut_off',
        'end_cut_off',
        'desc',
    ];

    protected $casts = [
        'seller_price' => 'decimal:2',
        'admin' => 'integer',
        'commission' => 'integer',
        'buyer_product_status' => 'boolean',
        'seller_product_status' => 'boolean',
        'unlimited_stock' => 'boolean',
        'multi' => 'boolean',
    ];
}
