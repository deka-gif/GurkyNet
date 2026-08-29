#!/usr/bin/env bash
cd /var/www/GurkyNet/laravel
php << 'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Services\ProductProviders\LogicalProductKey;

$slugs = LogicalProductKey::categoryFilterSlugs('topup-digital');
$rows = Product::query()
    ->whereHas('category', fn ($q) => $q->whereIn('slug', $slugs))
    ->whereHas('providerSkus', function ($q) {
        $q->where('product_provider_skus.is_active', true)
            ->whereHas('productProvider', fn ($pp) => $pp->where('product_providers.is_active', true));
    })
    ->select('ops_status')
    ->selectRaw('count(*) as c')
    ->groupBy('ops_status')
    ->get();
echo "ops_status breakdown:\n";
foreach ($rows as $r) {
    echo "  " . ($r->ops_status ?? 'NULL') . " x{$r->c}\n";
}

$opsFilter = Product::query()
    ->whereHas('category', fn ($q) => $q->whereIn('slug', $slugs))
    ->whereHas('providerSkus', function ($q) {
        $q->where('product_provider_skus.is_active', true)
            ->whereHas('productProvider', fn ($pp) => $pp->where('product_providers.is_active', true));
    })
    ->where(function ($q) {
        $q->whereNull('products.ops_status')->orWhere('products.ops_status', '!=', 'inactive');
    });
echo "after ops filter count: " . $opsFilter->count() . "\n";
PHP
