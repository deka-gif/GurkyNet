<?php
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Services\Catalog\ProductMappingService;
use Illuminate\Support\Str;

$mapping = app(ProductMappingService::class);
$vipProviderIds = ProductProvider::query()->where('code', 'like', 'vip%')->pluck('id')->all();

$sourceTransitions = [];
$byCategory = [];

Product::with(['category', 'provider', 'productProvider'])->chunkById(500, function ($products) use (
    $mapping, $vipProviderIds, &$sourceTransitions, &$byCategory
) {
    foreach ($products as $product) {
        $brand = (string) ($product->provider?->name ?? '');
        $sku = (string) ($product->sku_code ?? '');
        $isVip = in_array($product->product_provider_id, $vipProviderIds, true)
            || Str::startsWith(Str::upper($sku), 'VIP-');

        if ($isVip) {
            $rawCategory = (string) ($product->category?->slug ?? $product->category?->name ?? 'prepaid');
            $isGame = Str::contains(Str::lower($brand.' '.$product->name), ['diamond', 'game', 'mlbb', 'free fire']);
            $mapped = $mapping->map('vip', $rawCategory, $brand, (string) ($product->name ?? ''), $isGame);
        } else {
            $digi = DigiflazzProduct::query()->where('buyer_sku_code', $sku)->first();
            $rawCategory = $digi
                ? (string) ($digi->category ?? 'Umum')
                : (string) ($product->category?->slug ?? $product->category?->name ?? '');
            $mapped = $mapping->map(
                'digiflazz',
                $rawCategory,
                (string) ($digi->brand ?? $brand),
                (string) ($product->name ?? ''),
                false
            );
        }

        $fromSlug = (string) ($product->category?->slug ?? '');
        $oldSource = (string) ($product->category_mapping_source ?? '(null)');
        $newSource = (string) ($mapped['source'] ?? '');
        $slugChanged = $fromSlug !== ($mapped['slug'] ?? '');
        $sourceChanged = $oldSource !== $newSource;

        if (! $slugChanged && ! $sourceChanged) {
            continue;
        }

        if ($slugChanged) {
            echo "UNEXPECTED SLUG CHANGE: {$sku} {$fromSlug} → {$mapped['slug']}\n";
        }

        if ($sourceChanged && ! $slugChanged) {
            $key = "{$oldSource} → {$newSource}";
            $sourceTransitions[$key] = ($sourceTransitions[$key] ?? 0) + 1;
            $byCategory[$fromSlug] = ($byCategory[$fromSlug] ?? 0) + 1;
        }
    }
});

echo "=== SOURCE-ONLY CHANGES (234 expected) ===\n";
arsort($sourceTransitions);
foreach ($sourceTransitions as $k => $n) {
    echo sprintf("%-50s %5d\n", $k, $n);
}

echo "\n=== SOURCE-ONLY BY CURRENT CATEGORY SLUG ===\n";
arsort($byCategory);
foreach ($byCategory as $slug => $n) {
    echo sprintf("%-30s %5d\n", $slug, $n);
}

echo "\n=== TAGIHAN GENERIC — would slug change? ===\n";
$tagihanId = \App\Models\ProductCategory::where('slug', 'tagihan')->value('id');
$wouldMove = 0;
$stay = 0;
foreach (Product::where('product_category_id', $tagihanId)->with('provider')->get() as $product) {
    $digi = DigiflazzProduct::where('buyer_sku_code', $product->sku_code)->first();
    $raw = $digi ? (string) $digi->category : 'unknown';
    $mapped = $mapping->map('digiflazz', $raw, (string) ($digi->brand ?? $product->provider?->name ?? ''), $product->name, false);
    if ($mapped['slug'] !== 'tagihan') {
        $wouldMove++;
        echo "  {$product->sku_code}: tagihan → {$mapped['slug']} (raw Digi cat: {$raw}, source: {$mapped['source']})\n";
    } else {
        $stay++;
    }
}
echo "tagihan stay={$stay} would_move={$wouldMove}\n";
