<?php
/** Test HTTP + API response counts on VPS. Usage: php scripts/test-catalog-http.php */

$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Resources\ProductResource;
use App\Actions\Product\SearchProductAction;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Support\Facades\Cache;

$categories = ['game', 'voucher-digital', 'langganan-digital', 'international', 'topup-digital'];
$search = app(SearchProductAction::class);

echo "=== Direct SearchProductAction (bypass HTTP) ===\n";
foreach ($categories as $cat) {
    try {
        Cache::forget(ProductCatalogCache::searchKey(['category' => $cat, 'per_page' => 5000, 'page' => 1]));
        $page = $search->execute(['category' => $cat, 'per_page' => 5000, 'page' => 1]);
        $items = $page->items();
        $listed = 0;
        $providers = [];
        foreach ($items as $product) {
            $arr = (new ProductResource($product))->resolve();
            $status = $arr['status'] ?? '';
            $visible = $arr['isCatalogVisible'] ?? false;
            $op = $arr['operatorName'] ?? '?';
            if ($status === 'tersedia' || $status === 'maintenance' || $visible) {
                $listed++;
                $providers[$op] = ($providers[$op] ?? 0) + 1;
            }
        }
        echo "{$cat}: total={$page->total()} api_items=" . count($items) . " frontend_listed={$listed} providers=" . count($providers) . "\n";
        if ($listed === 0 && count($items) > 0) {
            $sample = (new ProductResource($items[0]))->resolve();
            echo "  sample_status={$sample['status']} avail={$sample['availabilityStatus']} catalogVisible=" . ($sample['isCatalogVisible'] ? '1' : '0') . " purchasable=" . ($sample['isPurchasable'] ? '1' : '0') . "\n";
        }
    } catch (\Throwable $e) {
        echo "{$cat}: ERROR " . $e->getMessage() . "\n";
    }
}

echo "\n=== HTTP localhost curl ===\n";
foreach ($categories as $cat) {
    $url = "http://127.0.0.1/api/v1/products?category={$cat}&per_page=5000";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_TIMEOUT => 120,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode((string) $body, true);
    $total = $json['pagination']['total'] ?? '?';
    $count = is_array($json['data'] ?? null) ? count($json['data']) : 0;
    $success = ($json['success'] ?? false) ? 'true' : 'false';
    $msg = $json['message'] ?? '';
    echo "{$cat}: http={$code} success={$success} total={$total} data_count={$count}";
    if ($msg && ($json['success'] ?? true) === false) {
        echo " msg={$msg}";
    }
    echo "\n";
}

echo "\n=== Cache directory writable? ===\n";
$cacheDir = storage_path('framework/cache/data');
echo "cache_dir={$cacheDir} exists=" . (is_dir($cacheDir) ? 'yes' : 'no') . " writable=" . (is_writable($cacheDir) ? 'yes' : 'no') . "\n";
$testFile = $cacheDir . '/diag-write-test-' . getmypid();
$writeOk = @file_put_contents($testFile, 'ok') !== false;
echo "write_test=" . ($writeOk ? 'ok' : 'FAIL') . "\n";
if ($writeOk) {
    @unlink($testFile);
}

echo "DONE\n";
