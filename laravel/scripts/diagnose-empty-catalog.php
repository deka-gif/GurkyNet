<?php
/**
 * Langkah 1 diagnosis — empty catalog (game, voucher-digital, langganan-digital, international).
 * Usage: php scripts/diagnose-empty-catalog.php [--trace] [--sample-ids=1,2,3]
 */

$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Actions\Product\SearchProductAction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Services\Catalog\ProductMappingService;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

$trace = in_array('--trace', $argv, true);
$sampleArg = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--sample-ids=')) {
        $sampleArg = substr($arg, strlen('--sample-ids='));
    }
}

echo "=== DIAGNOSE EMPTY CATALOG ===\n";
echo 'catalog_trace_enabled=' . (config('app.catalog_trace_enabled') ? 'true' : 'false') . "\n";
echo 'catalog_version=' . ProductCatalogCache::version() . "\n\n";

// 1a
echo "=== 1a ProductCategory slugs ===\n";
$slugs = ['game', 'voucher-digital', 'langganan-digital', 'international', 'topup-digital'];
$rows = ProductCategory::whereIn('slug', $slugs)->get(['id', 'slug', 'name']);
foreach ($slugs as $slug) {
    $matches = $rows->where('slug', $slug);
    echo sprintf(
        "slug=%s count=%d ids=%s names=%s\n",
        $slug,
        $matches->count(),
        $matches->pluck('id')->implode(','),
        $matches->pluck('name')->implode('|')
    );
}

// 1b
echo "\n=== 1b All ProductCategory (name duplicates check) ===\n";
$allCats = ProductCategory::orderBy('name')->get(['id', 'slug', 'name']);
$nameGroups = $allCats->groupBy(fn ($c) => strtolower(trim($c->name)));
foreach ($nameGroups as $name => $group) {
    if ($group->count() > 1) {
        echo "DUPLICATE NAME \"{$name}\":\n";
        foreach ($group as $c) {
            echo "  id={$c->id} slug={$c->slug} name={$c->name}\n";
        }
    }
}
$targetNames = ['Game', 'Voucher Digital', 'Langganan Digital', 'International Top Up', 'Top Up Digital'];
foreach ($targetNames as $n) {
    $g = $allCats->filter(fn ($c) => strcasecmp(trim($c->name), $n) === 0);
    if ($g->isNotEmpty()) {
        echo "NAME \"{$n}\": ";
        foreach ($g as $c) {
            echo "id={$c->id} slug={$c->slug}; ";
        }
        echo "\n";
    }
}

// Product providers status
echo "\n=== Product Providers ===\n";
foreach (ProductProvider::query()->get(['id', 'code', 'is_active', 'priority']) as $pp) {
    $activeSkus = ProductProviderSku::where('product_provider_id', $pp->id)->where('is_active', 1)->count();
    echo "id={$pp->id} code={$pp->code} is_active=" . ($pp->is_active ? '1' : '0') . " active_skus={$activeSkus}\n";
}

$mapping = app(ProductMappingService::class);
$search = app(SearchProductAction::class);

$categories = ['game', 'voucher-digital', 'langganan-digital', 'international', 'topup-digital'];

foreach ($categories as $cat) {
    echo "\n=== CATEGORY: {$cat} ===\n";
    $filterSlugs = $mapping->filterSlugs($cat);
    echo 'filterSlugs=' . json_encode($filterSlugs) . "\n";

    $catIds = ProductCategory::whereIn('slug', $filterSlugs)->pluck('id')->all();
    echo 'category_ids=' . json_encode($catIds) . "\n";

    // Raw SQL counts (no visibility gate)
    $rawTotal = Product::query()
        ->whereIn('product_category_id', $catIds)
        ->whereNull('deleted_at')
        ->count();
    echo "raw_products_in_category={$rawTotal}\n";

    $rawActiveOps = Product::query()
        ->whereIn('product_category_id', $catIds)
        ->whereNull('deleted_at')
        ->where(function ($q) {
            $q->whereNull('ops_status')->orWhere('ops_status', '!=', 'inactive');
        })
        ->count();
    echo "raw_ops_not_inactive={$rawActiveOps}\n";

    $withActiveSku = Product::query()
        ->whereIn('product_category_id', $catIds)
        ->whereNull('deleted_at')
        ->where(function ($q) {
            $q->whereNull('ops_status')->orWhere('ops_status', '!=', 'inactive');
        })
        ->whereHas('providerSkus', function ($q) {
            $q->where('is_active', 1)
                ->whereHas('productProvider', fn ($pp) => $pp->where('is_active', 1));
        })
        ->count();
    echo "visible_via_control_center_gate={$withActiveSku}\n";

    // Breakdown by provider code
    $breakdown = DB::table('products')
        ->join('product_categories', 'products.product_category_id', '=', 'product_categories.id')
        ->join('product_provider_skus', 'products.id', '=', 'product_provider_skus.product_id')
        ->join('product_providers', 'product_provider_skus.product_provider_id', '=', 'product_providers.id')
        ->whereIn('product_categories.slug', $filterSlugs)
        ->whereNull('products.deleted_at')
        ->select(
            'product_providers.code',
            DB::raw('SUM(CASE WHEN product_provider_skus.is_active=1 AND product_providers.is_active=1 THEN 1 ELSE 0 END) as visible_pairs'),
            DB::raw('SUM(CASE WHEN product_provider_skus.is_active=1 THEN 1 ELSE 0 END) as sku_active_pairs'),
            DB::raw('COUNT(DISTINCT products.id) as distinct_products')
        )
        ->groupBy('product_providers.code')
        ->get();
    foreach ($breakdown as $b) {
        echo "  provider={$b->code} distinct_products={$b->distinct_products} sku_active_pairs={$b->sku_active_pairs} visible_pairs={$b->visible_pairs}\n";
    }

    // SKU inactive reasons sample
    $hiddenSample = Product::query()
        ->with(['providerSkus.productProvider', 'category', 'provider'])
        ->whereIn('product_category_id', $catIds)
        ->whereNull('deleted_at')
        ->where(function ($q) {
            $q->whereNull('ops_status')->orWhere('ops_status', '!=', 'inactive');
        })
        ->limit(5)
        ->get();

    echo "sample_products_visibility:\n";
    foreach ($hiddenSample as $p) {
        $visible = false;
        $skuLines = [];
        foreach ($p->providerSkus as $sku) {
            $pp = $sku->productProvider;
            $skuVis = (bool) ($sku->is_active && $pp && $pp->is_active);
            if ($skuVis) {
                $visible = true;
            }
            $skuLines[] = sprintf(
                'sku_active=%s provider=%s provider_active=%s',
                $sku->is_active ? '1' : '0',
                $pp?->code ?? '?',
                ($pp && $pp->is_active) ? '1' : '0'
            );
        }
        echo "  id={$p->id} sku={$p->sku_code} ops={$p->ops_status} status=" . ($p->status ? '1' : '0') . " visible={$visible} skus=[" . implode('; ', $skuLines ?: ['NONE']) . "]\n";
    }

    // API path (SearchProductAction — same as GET /products)
    Cache::forget(ProductCatalogCache::searchKey(['category' => $cat, 'per_page' => 15, 'page' => 1]));
    $page = $search->execute(['category' => $cat, 'per_page' => 500, 'page' => 1]);
    echo "search_action_total={$page->total()} page_items=" . $page->count() . "\n";
}

// 1d sample cross-check
if ($sampleArg) {
    $ids = array_filter(array_map('intval', explode(',', $sampleArg)));
    echo "\n=== 1d Sample product cross-check ids=" . implode(',', $ids) . " ===\n";
    Product::with('providerSkus.productProvider', 'category', 'provider')
        ->whereIn('id', $ids)
        ->get()
        ->each(function ($p) {
            echo $p->id . ' | cat=' . ($p->category->slug ?? '?') . ' | ops_status=' . ($p->ops_status ?? 'null') . ' | status=' . ($p->status ? '1' : '0') . PHP_EOL;
            foreach ($p->providerSkus as $sku) {
                echo '   sku_active=' . ($sku->is_active ? '1' : '0')
                    . ' provider=' . ($sku->productProvider->code ?? '?')
                    . ' provider_active=' . (($sku->productProvider->is_active ?? false) ? '1' : '0') . PHP_EOL;
            }
            if ($p->providerSkus->isEmpty()) {
                echo "   NO providerSkus rows\n";
            }
        });
}

if ($trace) {
    echo "\n=== TRACE MODE: re-run one category with catalog_trace_enabled=true ===\n";
    echo "Set CATALOG_TRACE_ENABLED=true and tail storage/logs/laravel.log\n";
}

echo "\nDONE\n";
