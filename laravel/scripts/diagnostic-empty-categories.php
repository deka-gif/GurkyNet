<?php
/**
 * READ-ONLY diagnostic — empty e-wallet / voucher-digital / tagihan categories.
 * Run: cd /var/www/GurkyNet/laravel && php scripts/diagnostic-empty-categories.php
 */
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Support\Facades\DB;

echo "=== 1. Products by category slug ===\n";
foreach (Product::selectRaw('product_category_id, count(*) as total')
    ->groupBy('product_category_id')
    ->orderByDesc('total')
    ->get() as $row) {
    $cat = ProductCategory::find($row->product_category_id);
    echo ($cat->slug ?? 'NULL') . ' => ' . $row->total . "\n";
}

echo "\n=== 2. Bebas Nominal products ===\n";
$bebas = Product::where('name', 'like', '%Bebas Nominal%')
    ->get(['id', 'sku_code', 'name', 'product_category_id', 'ops_status', 'status']);
if ($bebas->isEmpty()) {
    echo "EMPTY — no rows matching '%Bebas Nominal%'\n";
} else {
    foreach ($bebas as $p) {
        $slug = ProductCategory::find($p->product_category_id)?->slug;
        echo json_encode([...$p->toArray(), 'category_slug' => $slug], JSON_UNESCAPED_UNICODE) . "\n";
    }
}

echo "\n=== 2b digiflazz_products E-MONEY ===\n";
$emoneyCount = DB::table('digiflazz_products')->where('category', 'like', '%E-MONEY%')->count();
echo "e-money_rows_total={$emoneyCount}\n";
$emoneySample = DB::table('digiflazz_products')->where('category', 'like', '%E-MONEY%')->limit(10)->get();
foreach ($emoneySample as $r) {
    echo json_encode((array) $r, JSON_UNESCAPED_UNICODE) . "\n";
}

echo "\n=== 6. topup-digital / ewallet ops breakdown ===\n";
$ids = ProductCategory::whereIn('slug', ['topup-digital', 'ewallet'])->pluck('id');
foreach (Product::whereIn('product_category_id', $ids)
    ->selectRaw('ops_status, status, count(*) as c')
    ->groupBy('ops_status', 'status')
    ->get() as $e) {
    echo "ops={$e->ops_status} status={$e->status} => {$e->c}\n";
}
echo 'total=' . Product::whereIn('product_category_id', $ids)->count() . "\n";

echo "\n=== 7. tagihan subcategories ===\n";
$tagihanSlugs = [
    'tagihan', 'pln-pascabayar', 'pdam', 'bpjs-kesehatan', 'bpjs-tk',
    'internet-pascabayar', 'internet', 'tv-pascabayar', 'tv',
    'gas', 'pbb', 'samsat', 'multifinance', 'pln', 'lainnya',
];
foreach ($tagihanSlugs as $slug) {
    $cat = ProductCategory::where('slug', $slug)->first();
    if (! $cat) {
        echo "{$slug} => NO CATEGORY ROW\n";
        continue;
    }
    $t = Product::where('product_category_id', $cat->id)->count();
    $a = Product::where('product_category_id', $cat->id)
        ->where('ops_status', 'active')
        ->where('status', 1)
        ->count();
    echo "{$slug} (id={$cat->id}) total={$t} active_ops_status={$a}\n";
}

echo "\n=== voucher-digital ===\n";
$vd = ProductCategory::where('slug', 'voucher-digital')->first();
if ($vd) {
    $t = Product::where('product_category_id', $vd->id)->count();
    $a = Product::where('product_category_id', $vd->id)->where('ops_status', 'active')->count();
    echo "total={$t} active_ops={$a}\n";
} else {
    echo "NO CATEGORY ROW\n";
}

echo "\n=== sync settings ===\n";
foreach ([
    'digiflazz_last_sync_at',
    'digiflazz_last_sync_status',
    'digiflazz_last_sync_count',
    'digiflazz_last_sync_summary',
    'digiflazz_last_sync_message',
    'catalog_auto_sync_last_run',
    'catalog_auto_sync_last_status',
] as $k) {
    $v = DB::table('settings')->where('key', $k)->value('value');
    echo $k . '=' . substr((string) $v, 0, 500) . "\n";
}

echo "\n=== digiflazz_products by type ===\n";
foreach (DB::table('digiflazz_products')->selectRaw('type, count(*) as c')->groupBy('type')->get() as $r) {
    echo "type={$r->type} count={$r->c}\n";
}

echo "\n=== digiflazz_products pasca categories sample ===\n";
$pascaCats = DB::table('digiflazz_products')
    ->where('type', 'pasca')
    ->selectRaw('category, count(*) as c')
    ->groupBy('category')
    ->orderByDesc('c')
    ->limit(20)
    ->get();
foreach ($pascaCats as $r) {
    echo "{$r->category} => {$r->c}\n";
}

echo "\n=== all product_categories slugs ===\n";
foreach (ProductCategory::orderBy('slug')->get(['id', 'slug', 'name']) as $c) {
    echo "{$c->id}\t{$c->slug}\t{$c->name}\n";
}

echo "\n=== digiflazz list_type breakdown ===\n";
foreach (DB::table('digiflazz_products')->selectRaw('list_type, count(*) as c')->groupBy('list_type')->get() as $r) {
    echo "{$r->list_type} => {$r->c}\n";
}
echo 'pasca_total=' . DB::table('digiflazz_products')->where('list_type', 'pasca')->count() . "\n";

echo "\n=== E-MONEY buyer_product_status ===\n";
foreach (DB::table('digiflazz_products')->where('category', 'like', '%E-Money%')
    ->selectRaw('buyer_product_status, count(*) as c')->groupBy('buyer_product_status')->get() as $r) {
    echo "buyer_status={$r->buyer_product_status} => {$r->c}\n";
}

echo "\n=== topup-digital active sample + provider link ===\n";
$catId = ProductCategory::where('slug', 'topup-digital')->value('id');
foreach (Product::where('product_category_id', $catId)->where('ops_status', 'active')->where('status', 1)->limit(8)->get() as $p) {
    $sku = DB::table('product_provider_skus')->where('product_id', $p->id)->first();
    echo json_encode([
        'id' => $p->id, 'sku' => $p->sku_code, 'name' => $p->name,
        'provider_sku_active' => $sku->is_active ?? null,
    ], JSON_UNESCAPED_UNICODE) . "\n";
}

echo "\n=== product_sync_runs (pasca, latest 5) ===\n";
$runs = DB::table('product_sync_runs')->where('list_type', 'pasca')->orderByDesc('id')->limit(5)->get();
echo $runs->isEmpty() ? "NO PASCA SYNC RUNS RECORDED\n" : '';
foreach ($runs as $r) {
    echo json_encode((array) $r) . "\n";
}

echo "\n=== product_sync_runs (all types, latest 5) ===\n";
foreach (DB::table('product_sync_runs')->orderByDesc('id')->limit(5)->get() as $r) {
    echo json_encode((array) $r) . "\n";
}

echo "\n=== voucher-digital listed vs active ===\n";
$vdId = ProductCategory::where('slug', 'voucher-digital')->value('id');
foreach (Product::where('product_category_id', $vdId)
    ->selectRaw('ops_status, status, count(*) as c')->groupBy('ops_status', 'status')->get() as $e) {
    echo "ops={$e->ops_status} status={$e->status} => {$e->c}\n";
}

echo "\n=== providers endpoint simulation topup-digital ===\n";
$action = app(\App\Actions\Product\GetCategoryProviderSummaryAction::class);
try {
    $summary = $action->execute('topup-digital');
    echo json_encode($summary, JSON_UNESCAPED_UNICODE) . "\n";
} catch (Throwable $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
}

echo "\n=== Bebas / LinkAja / pasca E-MONEY search in digiflazz_products ===\n";
foreach (['Bebas Nominal', 'LinkAja', 'LINKAJA', 'Gopay Bebas', 'Dana Bebas'] as $term) {
    $c = DB::table('digiflazz_products')->where('product_name', 'like', "%{$term}%")->count();
    echo "{$term} => {$c}\n";
}

echo "\n=== product_providers status ===\n";
foreach (DB::table('product_providers')->get() as $pp) {
    echo json_encode((array) $pp) . "\n";
}

echo "\n=== topup-digital visibility drill-down ===\n";
$catId = ProductCategory::where('slug', 'topup-digital')->value('id');
$total = Product::where('product_category_id', $catId)->count();
$activeOps = Product::where('product_category_id', $catId)->where('ops_status', 'active')->count();
$withSku = Product::where('product_category_id', $catId)
    ->whereHas('providerSkus', fn ($q) => $q->where('is_active', 1))
    ->count();
$repoCount = app(\App\Repositories\Contracts\ProductRepositoryInterface::class)
    ->getActiveProductsForCategory('topup-digital')->count();
echo "total={$total} active_ops={$activeOps} with_active_sku={$withSku} repo_visible={$repoCount}\n";

echo "\n=== voucher-digital visibility ===\n";
$vdRepo = app(\App\Repositories\Contracts\ProductRepositoryInterface::class)
    ->getActiveProductsForCategory('voucher-digital')->count();
echo "repo_visible={$vdRepo}\n";

echo "\n=== tagihan visibility ===\n";
foreach (['tagihan', 'pln-pascabayar', 'pdam', 'gas'] as $slug) {
    $cnt = app(\App\Repositories\Contracts\ProductRepositoryInterface::class)
        ->getActiveProductsForCategory($slug)->count();
    echo "{$slug} repo_visible={$cnt}\n";
}

echo "\n=== topup-digital SKU by product_provider ===\n";
$catId = ProductCategory::where('slug', 'topup-digital')->value('id');
foreach (DB::table('product_provider_skus as pps')
    ->join('products as p', 'p.id', '=', 'pps.product_id')
    ->join('product_providers as pp', 'pp.id', '=', 'pps.product_provider_id')
    ->where('p.product_category_id', $catId)
    ->where('pps.is_active', 1)
    ->selectRaw('pp.code, count(*) as c')
    ->groupBy('pp.code')
    ->get() as $r) {
    echo "{$r->code} active_skus={$r->c}\n";
}

echo "\n=== voucher-digital SKU by product_provider ===\n";
$vdId = ProductCategory::where('slug', 'voucher-digital')->value('id');
foreach (DB::table('product_provider_skus as pps')
    ->join('products as p', 'p.id', '=', 'pps.product_id')
    ->join('product_providers as pp', 'pp.id', '=', 'pps.product_provider_id')
    ->where('p.product_category_id', $vdId)
    ->where('pps.is_active', 1)
    ->selectRaw('pp.code, count(*) as c')
    ->groupBy('pp.code')
    ->get() as $r) {
    echo "{$r->code} active_skus={$r->c}\n";
}

echo "\n=== digiflazz active SKUs mapped to topup-digital/voucher ===\n";
foreach (['topup-digital', 'voucher-digital'] as $slug) {
    $cid = ProductCategory::where('slug', $slug)->value('id');
    $n = DB::table('product_provider_skus as pps')
        ->join('products as p', 'p.id', '=', 'pps.product_id')
        ->where('p.product_category_id', $cid)
        ->where('pps.product_provider_id', 1)
        ->where('pps.is_active', 1)
        ->count();
    echo "{$slug} digiflazz_active_skus={$n}\n";
}

echo "\n=== activity log ops_status / ewallet (latest 10) ===\n";
$logs = DB::table('activity_logs')
    ->where(function ($q) {
        $q->where('activity', 'like', '%PRODUCT%')
            ->orWhere('activity', 'like', '%SYNC%')
            ->orWhere('activity', 'like', '%EWALLET%')
            ->orWhere('activity', 'like', '%CATALOG%');
    })
    ->orderByDesc('id')
    ->limit(10)
    ->get(['id', 'activity', 'created_at', 'payload']);
foreach ($logs as $l) {
    echo "{$l->id} {$l->created_at} {$l->activity} " . substr((string) $l->payload, 0, 120) . "\n";
}
