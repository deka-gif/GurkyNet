<?php
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;

echo "=== 24 produk slug=tagihan ===\n";
$cat = ProductCategory::where('slug', 'tagihan')->first();
if (! $cat) {
    echo "NO tagihan category\n";
    exit(1);
}
$rows = Product::where('product_category_id', $cat->id)
    ->orderBy('sku_code')
    ->get(['id', 'sku_code', 'name', 'product_provider_id']);
echo 'count=' . $rows->count() . "\n";
foreach ($rows as $p) {
    $digi = DigiflazzProduct::where('buyer_sku_code', $p->sku_code)->first();
    echo $p->sku_code . ' | ' . $p->name . ' | digi_category=' . ($digi->category ?? 'N/A') . ' | digi_brand=' . ($digi->brand ?? 'N/A') . "\n";
}

echo "\n=== 3 produk pembanding (pdam, bpjs-kesehatan, gas) ===\n";
foreach (['pdam', 'bpjs-kesehatan', 'gas'] as $slug) {
    $c = ProductCategory::where('slug', $slug)->first();
    if (! $c) {
        echo "{$slug}: NO CATEGORY\n";
        continue;
    }
    $p = Product::where('product_category_id', $c->id)->orderBy('id')->first();
    if (! $p) {
        echo "{$slug}: NO PRODUCT\n";
        continue;
    }
    $digi = DigiflazzProduct::where('buyer_sku_code', $p->sku_code)->first();
    echo "[{$slug}] " . $p->sku_code . ' | ' . $p->name . ' | digi_category=' . ($digi->category ?? 'N/A') . ' | digi_brand=' . ($digi->brand ?? 'N/A') . "\n";
}

echo "\n=== post-remap slug move check ===\n";
$mapping = app(\App\Services\Catalog\ProductMappingService::class);
$slugMoves = 0;
Product::with('category')->chunkById(500, function ($products) use ($mapping, &$slugMoves) {
    foreach ($products as $product) {
        $digi = DigiflazzProduct::where('buyer_sku_code', $product->sku_code)->first();
        if (! $digi) {
            continue;
        }
        $mapped = $mapping->map('digiflazz', (string) $digi->category, (string) $digi->brand, (string) $product->name, false);
        if ($product->category?->slug !== $mapped['slug']) {
            $slugMoves++;
        }
    }
});
echo "remaining_would_be_slug_moves={$slugMoves}\n";
