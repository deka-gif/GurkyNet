#!/usr/bin/env bash
cd /var/www/GurkyNet/laravel
php << 'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Repositories\Eloquent\ProductRepository;

$products = Product::with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])
    ->whereHas('category', fn ($q) => $q->where('slug', 'topup-digital'))
    ->where('status', 1)
    ->limit(5)
    ->get();

$repo = app(ProductRepository::class);
$ref = new ReflectionClass($repo);
$vis = $ref->getMethod('isVisibleViaControlCenter');
$vis->setAccessible(true);

echo "Sample topup-digital products visibility:\n";
foreach ($products as $p) {
    $visible = $vis->invoke($repo, $p);
    $skuCount = $p->providerSkus->where('is_active', 1)->count();
    echo "{$p->sku_code} | {$p->provider?->name} | skus_active={$skuCount} | visible=" . ($visible ? 'Y' : 'N') . "\n";
}

$filters = ['category' => 'topup-digital', 'per_page' => 50];
$page = app(\App\Actions\Product\SearchProductAction::class)->execute($filters);
echo "\nSearchProductAction total: {$page->total()}\n";
PHP
