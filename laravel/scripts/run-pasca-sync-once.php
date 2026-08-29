<?php
/**
 * ONE-SHOT controlled pasca sync — diagnostic run only.
 * Usage: cd laravel && php scripts/run-pasca-sync-once.php
 */
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Support\Facades\DB;

echo "=== BEFORE ===\n";
echo 'pasca_staging=' . DB::table('digiflazz_products')->where('list_type', 'pasca')->count() . "\n";
echo 'bebas_nominal=' . Product::where('name', 'like', '%Bebas Nominal%')->count() . "\n";

$lastPrepaid = DB::table('settings')->where('key', 'digiflazz_last_sync_at')->value('value');
echo "last_sync_at={$lastPrepaid}\n\n";

echo "=== RUNNING pasca sync (single attempt) ===\n";
try {
    $result = app(\App\Actions\Admin\Operations\SyncDigiflazzCatalogAction::class)->execute([
        'cmd' => ['pasca'],
        'inline_all_cmds' => true,
        'triggered_by' => 'diagnostic',
    ]);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
} catch (Throwable $e) {
    echo 'EXCEPTION: ' . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n=== AFTER ===\n";
echo 'pasca_staging=' . DB::table('digiflazz_products')->where('list_type', 'pasca')->count() . "\n";
echo 'pasca_emoney=' . DB::table('digiflazz_products')->where('list_type', 'pasca')->where('category', 'like', '%E-Money%')->count() . "\n";

$bebas = Product::where('name', 'like', '%Bebas Nominal%')->get(['id', 'sku_code', 'name', 'product_category_id', 'ops_status']);
echo "bebas_nominal_products={$bebas->count()}\n";
foreach ($bebas as $p) {
    $slug = ProductCategory::find($p->product_category_id)?->slug;
    echo json_encode([...$p->toArray(), 'category_slug' => $slug], JSON_UNESCAPED_UNICODE) . "\n";
}

echo "\n=== pasca sample (first 5) ===\n";
foreach (DB::table('digiflazz_products')->where('list_type', 'pasca')->limit(5)->get() as $r) {
    echo json_encode((array) $r, JSON_UNESCAPED_UNICODE) . "\n";
}

echo "\n=== topup-digital from pasca mapping ===\n";
$catId = ProductCategory::where('slug', 'topup-digital')->value('id');
$recent = Product::where('product_category_id', $catId)
    ->orderByDesc('updated_at')
    ->limit(10)
    ->get(['id', 'sku_code', 'name', 'ops_status', 'updated_at']);
foreach ($recent as $p) {
    echo json_encode($p->toArray()) . "\n";
}
