<?php
$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Actions\Product\SearchProductAction;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Support\Facades\Cache;

$search = app(SearchProductAction::class);
$cats = ['game', 'voucher-digital', 'langganan-digital', 'international', 'topup-digital'];

foreach ($cats as $cat) {
    $filters = ['category' => $cat, 'per_page' => 5000, 'page' => 1];
    Cache::forget(ProductCatalogCache::searchKey($filters));

    $t0 = microtime(true);
    $page = $search->execute($filters);
    $coldMs = round((microtime(true) - $t0) * 1000);

    $t1 = microtime(true);
    $page2 = $search->execute($filters);
    $warmMs = round((microtime(true) - $t1) * 1000);

    echo "{$cat}: cold={$coldMs}ms warm={$warmMs}ms total={$page->total()}\n";
}

echo "axios_default_timeout=15000ms\n";
echo "DONE\n";
