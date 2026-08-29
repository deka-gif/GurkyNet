#!/usr/bin/env bash
# Activate user-catalog visibility for sellable topup-digital rows (ops_status was blocking API).
cd /var/www/GurkyNet/laravel
php << 'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Services\ProductProviders\LogicalProductKey;

$slugs = LogicalProductKey::categoryFilterSlugs('topup-digital');

$q = Product::query()
    ->whereHas('category', fn ($c) => $c->whereIn('slug', $slugs))
    ->whereHas('providerSkus', function ($s) {
        $s->where('product_provider_skus.is_active', true)
            ->whereHas('productProvider', fn ($pp) => $pp->where('product_providers.is_active', true));
    });

$before = (clone $q)->where('ops_status', 'inactive')->count();
$updated = (clone $q)->where('ops_status', 'inactive')->update(['ops_status' => 'active']);
echo "topup-digital ops_status inactive before: {$before}\n";
echo "updated to active: {$updated}\n";
PHP

sudo -u www-data php artisan cache:clear || true
bash /tmp/verify-api.sh
