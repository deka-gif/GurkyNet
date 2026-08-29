#!/usr/bin/env bash
cd /var/www/GurkyNet/laravel
php << 'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Simulate HTTP request for paginator
$request = \Illuminate\Http\Request::create('/api/v1/products?category=topup-digital&per_page=50', 'GET');
$app->instance('request', $request);

$repo = app(\App\Repositories\Eloquent\ProductRepository::class);
$ref = new ReflectionClass($repo);

$query = \App\Models\Product::query()->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);
$applyVis = $ref->getMethod('applyControlCenterVisibility');
$applyVis->setAccessible(true);
$applyVis->invoke($repo, $query);

$applyFilters = $ref->getMethod('applyListFilters');
$applyFilters->setAccessible(true);
$applyFilters->invoke($repo, $query, ['category' => 'topup-digital']);

$all = $query->orderBy('id')->get();
echo "after filters count: {$all->count()}\n";

$merge = $ref->getMethod('mergeDuplicateCatalogProducts');
$merge->setAccessible(true);
$merged = $merge->invoke($repo, $all);
echo "after merge count: {$merged->count()}\n";

foreach ($merged->take(8) as $p) {
    echo "  {$p->provider?->name} | {$p->name}\n";
}

$page = $repo->getPaginatedProducts(['category' => 'topup-digital', 'per_page' => 50]);
echo "paginated total: {$page->total()}\n";
PHP
