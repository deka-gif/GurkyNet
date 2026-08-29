<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Repositories\Contracts\ProductRepositoryInterface;
use Illuminate\Support\Facades\Cache;

Cache::forget('catalog:legacy-unmapped-repair:throttle');

$repo = app(ProductRepositoryInterface::class);

$start = microtime(true);
$repo->getPaginatedProducts(['category' => 'topup-digital', 'per_page' => 15]);
$coldMs = round((microtime(true) - $start) * 1000, 1);

$start = microtime(true);
$repo->getPaginatedProducts(['category' => 'topup-digital', 'per_page' => 15]);
$warmMs = round((microtime(true) - $start) * 1000, 1);

echo "repository topup-digital cold_ms={$coldMs} warm_ms={$warmMs}\n";
