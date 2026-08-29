#!/usr/bin/env bash
cd /var/www/GurkyNet/laravel
php << 'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$repo = app(\App\Repositories\Contracts\ProductRepositoryInterface::class);
$filters = ['category' => 'topup-digital', 'per_page' => 50, 'page' => 1];
$page = $repo->getPaginatedProducts($filters);
echo "Repository direct total: {$page->total()}\n";
foreach ($page->items() as $item) {
    echo ' - ' . ($item->provider?->name ?? '?') . ' | ' . $item->name . "\n";
}
PHP
