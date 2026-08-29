<?php
/**
 * Analyze catalog:remap-categories --dry-run scope (read-only).
 * Mirrors RemapProductCategoriesCommand logic; outputs grouped slug transitions.
 */
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

$changed = 0;
$unchanged = 0;
$sourceOnly = 0;
$unmapped = [];
/** @var array<string,int> */
$transitions = [];
/** @var array<string,list<string>> */
$transitionSamples = [];
/** @var array<string,list<array{sku:string,from:string,to:string,source:string,raw:string}>> */
$protectedExits = [
    'game' => [],
    'data' => [],
    'pulsa' => [],
    'topup-digital' => [],
    'voucher-digital' => [],
];

$resolveInputs = function (Product $product) use ($vipProviderIds): array {
    $brand = (string) ($product->provider?->name ?? '');
    $sku = (string) ($product->sku_code ?? '');
    $isVip = in_array($product->product_provider_id, $vipProviderIds, true)
        || Str::startsWith(Str::upper($sku), 'VIP-');
    if ($isVip) {
        $rawCategory = (string) ($product->category?->slug ?? $product->category?->name ?? 'prepaid');
        $isGame = Str::contains(Str::lower($brand.' '.$product->name), ['diamond', 'game', 'mlbb', 'free fire']);
        return ['vip', $rawCategory, $brand, $isGame];
    }
    $digi = DigiflazzProduct::query()->where('buyer_sku_code', $sku)->first();
    if ($digi) {
        return [
            'digiflazz',
            (string) ($digi->category ?? 'Umum'),
            (string) ($digi->brand ?: $brand),
            false,
        ];
    }
    return [
        'digiflazz',
        (string) ($product->category?->slug ?? $product->category?->name ?? ''),
        $brand,
        false,
    ];
};

Product::with(['category', 'provider', 'productProvider'])->chunkById(500, function ($products) use (
    $mapping, &$changed, &$unchanged, &$sourceOnly, &$unmapped, &$transitions, &$transitionSamples, &$protectedExits, $resolveInputs
) {
    foreach ($products as $product) {
        [$providerHint, $rawCategory, $brand, $isGameHint] = $resolveInputs($product);
        $mapped = $mapping->map($providerHint, $rawCategory, $brand, (string) ($product->name ?? ''), $isGameHint);

        if (($mapped['source'] ?? '') === 'unmapped_fallback') {
            $key = $rawCategory.'|'.$brand;
            $unmapped[$key] = ($unmapped[$key] ?? 0) + 1;
        }

        $fromSlug = (string) ($product->category?->slug ?? '');
        $toSlug = (string) ($mapped['slug'] ?? '');
        $sourceChanged = ($product->category_mapping_source ?? '') !== ($mapped['source'] ?? '');
        $slugChanged = $fromSlug !== $toSlug;

        if (! $slugChanged && ! $sourceChanged) {
            $unchanged++;
            continue;
        }

        $changed++;
        if ($slugChanged) {
            $pair = "{$fromSlug} → {$toSlug}";
            $transitions[$pair] = ($transitions[$pair] ?? 0) + 1;
            if (($transitionSamples[$pair] ?? []) === [] || count($transitionSamples[$pair]) < 3) {
                $transitionSamples[$pair][] = $product->sku_code;
            }
            if (isset($protectedExits[$fromSlug])) {
                $protectedExits[$fromSlug][] = [
                    'sku' => $product->sku_code,
                    'from' => $fromSlug,
                    'to' => $toSlug,
                    'source' => $mapped['source'] ?? '',
                    'raw' => "{$providerHint}|{$rawCategory}|{$brand}",
                ];
            }
        } else {
            $sourceOnly++;
        }
    }
});

echo "=== SUMMARY (mirrors catalog:remap-categories --dry-run) ===\n";
echo "Changed: {$changed}, Unchanged: {$unchanged}\n";
echo "  Of changed: slug_moves=" . array_sum($transitions) . ", source_only={$sourceOnly}\n";
echo 'Unmapped_fallback distinct keys: ' . count($unmapped) . "\n";
echo 'Unmapped_fallback product count: ' . array_sum($unmapped) . "\n\n";

echo "=== TRANSITIONS BY PAIR (slug changes only) ===\n";
arsort($transitions);
foreach ($transitions as $pair => $count) {
    $samples = implode(', ', $transitionSamples[$pair] ?? []);
    echo sprintf("%-45s %5d  [%s]\n", $pair, $count, $samples);
}

echo "\n=== PROTECTED CATEGORY EXITS (game/data/pulsa/topup-digital/voucher-digital) ===\n";
foreach ($protectedExits as $cat => $rows) {
    echo "{$cat}: " . count($rows) . " products would LEAVE this slug\n";
    foreach (array_slice($rows, 0, 15) as $r) {
        echo "  {$r['sku']}: {$r['from']} → {$r['to']} ({$r['source']}) raw=[{$r['raw']}]\n";
    }
    if (count($rows) > 15) {
        echo '  ... +' . (count($rows) - 15) . " more\n";
    }
}

if ($unmapped !== []) {
    echo "\n=== UNMAPPED_FALLBACK samples (top 20 keys) ===\n";
    arsort($unmapped);
    foreach (array_slice($unmapped, 0, 20, true) as $key => $count) {
        echo "  {$key} × {$count}\n";
    }
}

// Write full detail for tagihan-target transitions
$tagihanTargets = ['pln-pascabayar', 'pdam', 'bpjs-kesehatan', 'bpjs-tk', 'pbb', 'samsat', 'multifinance', 'tagihan', 'gas', 'internet-pascabayar', 'tv-pascabayar'];
echo "\n=== INBOUND TO TAGIHAN SUBCATEGORIES ===\n";
foreach ($transitions as $pair => $count) {
    foreach ($tagihanTargets as $t) {
        if (str_contains($pair, "→ {$t}")) {
            echo "{$pair}: {$count}\n";
        }
    }
}
