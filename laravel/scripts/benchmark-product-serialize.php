<?php
$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Actions\Product\SearchProductAction;
use App\Http\Resources\ProductResource;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Support\Facades\Cache;

$search = app(SearchProductAction::class);
$cat = 'game';
$filters = ['category' => $cat, 'per_page' => 5000, 'page' => 1];

// Warm cache first
Cache::forget(ProductCatalogCache::searchKey($filters));
$search->execute($filters);

$t0 = microtime(true);
$page = $search->execute($filters);
$repoMs = round((microtime(true) - $t0) * 1000);

$t1 = microtime(true);
$json = json_encode(ProductResource::collection($page)->resolve());
$serializeMs = round((microtime(true) - $t1) * 1000);

echo "game cached_repo={$repoMs}ms serialize={$serializeMs}ms total_items={$page->total()} json_bytes=" . strlen($json) . "\n";

foreach (['voucher-digital', 'langganan-digital', 'topup-digital'] as $c) {
    $f = ['category' => $c, 'per_page' => 5000, 'page' => 1];
    $p = $search->execute($f);
    $t2 = microtime(true);
    json_encode(ProductResource::collection($p)->resolve());
    echo "{$c} serialize=" . round((microtime(true) - $t2) * 1000) . "ms items={$p->total()}\n";
}

echo "axios_timeout=15000ms\nDONE\n";
