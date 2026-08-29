<?php
/** Cache + permissions + stale catalog key audit. */
$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Support\Facades\Cache;

$categories = ['game', 'voucher-digital', 'langganan-digital', 'international', 'topup-digital'];

echo "=== Catalog cache version: " . ProductCatalogCache::version() . " ===\n\n";

foreach ($categories as $cat) {
    $filters = ['category' => $cat, 'per_page' => 5000, 'page' => 1];
    $key = ProductCatalogCache::searchKey($filters);
    $hit = Cache::has($key);
    $val = Cache::get($key);
    $count = ($val instanceof \Illuminate\Pagination\LengthAwarePaginator) ? $val->total() : (is_object($val) ? 'object' : gettype($val));
    echo "{$cat}: key_exists=" . ($hit ? 'yes' : 'no') . " cached_total={$count}\n";
}

echo "\n=== Storage permissions ===\n";
$paths = [
    storage_path('framework/cache'),
    storage_path('framework/cache/data'),
    storage_path('logs'),
];
foreach ($paths as $p) {
    $owner = function_exists('posix_getpwuid') && file_exists($p)
        ? (posix_getpwuid(fileowner($p))['name'] ?? fileowner($p))
        : (file_exists($p) ? fileowner($p) : 'n/a');
    echo "{$p}: exists=" . (is_dir($p) ? 'yes' : 'no') . " writable=" . (is_writable($p) ? 'yes' : 'no') . " owner={$owner}\n";
}

echo "\n=== Simulate www-data cache write (if run via sudo) ===\n";
$testSub = storage_path('framework/cache/data/zz/zz');
@mkdir($testSub, 0775, true);
$testFile = $testSub . '/write-test.txt';
$ok = @file_put_contents($testFile, 'ok');
echo "nested_write=" . ($ok !== false ? 'ok' : 'FAIL:' . (error_get_last()['message'] ?? '')) . "\n";
if ($ok !== false) {
    @unlink($testFile);
    @rmdir($testSub);
    @rmdir(storage_path('framework/cache/data/zz'));
}

echo "\n=== International SKU detail ===\n";
$rows = \Illuminate\Support\Facades\DB::table('products')
    ->join('product_categories', 'products.product_category_id', '=', 'product_categories.id')
    ->join('product_provider_skus', 'products.id', '=', 'product_provider_skus.product_id')
    ->join('product_providers', 'product_provider_skus.product_provider_id', '=', 'product_providers.id')
    ->where('product_categories.slug', 'international')
    ->select('products.id', 'products.sku_code', 'products.ops_status', 'product_provider_skus.is_active as sku_active', 'product_providers.code')
    ->limit(10)
    ->get();
foreach ($rows as $r) {
    echo "id={$r->id} sku={$r->sku_code} ops={$r->ops_status} sku_active={$r->sku_active} provider={$r->code}\n";
}

echo "DONE\n";
