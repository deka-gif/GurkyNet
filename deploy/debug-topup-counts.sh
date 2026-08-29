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
echo "filter slugs: " . implode(', ', $slugs) . "\n";

$base = Product::query()->whereHas('category', fn ($q) => $q->whereIn('slug', $slugs));
echo "by category slug count: " . $base->count() . "\n";

$withSku = (clone $base)->whereHas('providerSkus', function ($q) {
    $q->where('product_provider_skus.is_active', true)
        ->whereHas('productProvider', fn ($pp) => $pp->where('product_providers.is_active', true));
});
echo "with active sku+provider count: " . $withSku->count() . "\n";

$sample = $withSku->with(['provider', 'category'])->limit(10)->get();
foreach ($sample as $p) {
    echo "  {$p->provider?->name} | cat={$p->category?->slug} | {$p->sku_code}\n";
}
PHP
