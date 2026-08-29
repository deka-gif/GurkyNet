<?php
/** Verify remap dry-run: expect exactly 14 tagihan → subcategory moves. */
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Services\Catalog\ProductMappingService;
use Illuminate\Support\Str;

$mapping = app(ProductMappingService::class);
$vipProviderIds = ProductProvider::query()->where('code', 'like', 'vip%')->pluck('id')->all();

$transitions = [];
$fromTagihan = [];

Product::with(['category', 'provider', 'productProvider'])->chunkById(500, function ($products) use (
    $mapping, $vipProviderIds, &$transitions, &$fromTagihan
) {
    foreach ($products as $product) {
        $brand = (string) ($product->provider?->name ?? '');
        $sku = (string) ($product->sku_code ?? '');
        $isVip = in_array($product->product_provider_id, $vipProviderIds, true)
            || Str::startsWith(Str::upper($sku), 'VIP-');
        if ($isVip) {
            continue;
        }
        $digi = DigiflazzProduct::where('buyer_sku_code', $sku)->first();
        if (! $digi) {
            continue;
        }
        $mapped = $mapping->map(
            'digiflazz',
            (string) $digi->category,
            (string) ($digi->brand ?: $brand),
            (string) $product->name,
            false
        );
        $from = (string) ($product->category?->slug ?? '');
        $to = (string) $mapped['slug'];
        if ($from === $to) {
            continue;
        }
        $pair = "{$from} → {$to}";
        $transitions[$pair] = ($transitions[$pair] ?? 0) + 1;
        if ($from === 'tagihan') {
            $fromTagihan[] = "{$product->sku_code} | {$product->name} | digi_brand={$digi->brand} → {$to}";
        }
    }
});

$totalMoves = array_sum($transitions);
echo "total_slug_moves={$totalMoves}\n";
foreach ($transitions as $pair => $n) {
    echo "{$pair}: {$n}\n";
}
echo "\n=== from tagihan detail ({$totalMoves} expected 14) ===\n";
foreach ($fromTagihan as $line) {
    echo $line . "\n";
}

$tagihanId = ProductCategory::where('slug', 'tagihan')->value('id');
$stay = Product::where('product_category_id', $tagihanId)->count();
echo "\ntagihan_products_current_count={$stay}\n";
