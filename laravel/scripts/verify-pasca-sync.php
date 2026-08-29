<?php
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Support\Facades\DB;

echo "=== PASCA STAGING ===\n";
echo 'pasca_total=' . DB::table('digiflazz_products')->where('list_type', 'pasca')->count() . "\n";
foreach (DB::table('digiflazz_products')->where('list_type', 'pasca')->where('category', 'like', '%E-Money%')->get() as $r) {
    echo json_encode((array) $r, JSON_UNESCAPED_UNICODE) . "\n";
}

echo "\n=== BEBAS NOMINAL in products ===\n";
foreach (Product::where('name', 'like', '%Bebas Nominal%')->get() as $p) {
    $slug = ProductCategory::find($p->product_category_id)?->slug;
    $sku = DB::table('product_provider_skus')->where('product_id', $p->id)->first();
    echo json_encode([
        'id' => $p->id, 'sku' => $p->sku_code, 'name' => $p->name,
        'cat' => $slug, 'ops' => $p->ops_status, 'digi_sku_active' => $sku->is_active ?? null,
    ], JSON_UNESCAPED_UNICODE) . "\n";
}

echo "\n=== pasca by category in products ===\n";
foreach (DB::table('products as p')
    ->join('product_categories as c', 'c.id', '=', 'p.product_category_id')
    ->join('product_provider_skus as pps', 'pps.product_id', '=', 'p.id')
    ->where('pps.product_provider_id', 1)
    ->whereIn('c.slug', ['topup-digital', 'pln-pascabayar', 'pdam', 'bpjs-kesehatan', 'bpjs-tk', 'pbb', 'samsat', 'multifinance', 'tagihan', 'gas', 'internet-pascabayar', 'tv-pascabayar'])
    ->selectRaw('c.slug, count(*) as c')
    ->groupBy('c.slug')
    ->get() as $r) {
    echo "{$r->slug} => {$r->c}\n";
}

echo "\n=== topup-digital repo visible ===\n";
echo app(\App\Repositories\Contracts\ProductRepositoryInterface::class)
    ->getActiveProductsForCategory('topup-digital')->count() . "\n";
