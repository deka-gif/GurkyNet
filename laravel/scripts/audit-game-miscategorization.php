<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Services\Catalog\ProductMappingService;

$mapping = app(ProductMappingService::class);
$targets = ['steam', 'alfamart', 'indomaret', 'razer', 'garena', 'google play', 'psn', 'playstation'];

echo "=== Products in GAME matching voucher/giftcard names ===\n";
$patterns = ['ALFAMART', 'Steam', 'INDOMARET', 'Razer', 'Garena Shell', 'PSN', 'Google Play'];
$gameProducts = Product::query()
    ->with(['category', 'provider'])
    ->whereHas('category', fn ($q) => $q->where('slug', 'game'))
    ->where(function ($q) use ($patterns) {
        foreach ($patterns as $pat) {
            $q->orWhere('name', 'like', '%'.$pat.'%');
        }
    })
    ->orderBy('name')
    ->get(['id', 'sku_code', 'name', 'product_category_id', 'provider_id', 'category_mapping_source']);

foreach ($gameProducts as $p) {
    $brand = (string) ($p->provider?->name ?? '');
    $mapped = $mapping->map('vip', 'game', $brand, (string) $p->name, true);
    echo json_encode([
        'sku' => $p->sku_code,
        'name' => $p->name,
        'brand' => $brand,
        'current' => $p->category?->slug,
        'would_map_to' => $mapped['slug'],
        'source' => $mapped['source'],
    ], JSON_UNESCAPED_UNICODE)."\n";
}

echo "\n=== By provider name in GAME category ===\n";
$byProvider = DB::table('products as p')
    ->join('product_categories as c', 'p.product_category_id', '=', 'c.id')
    ->join('providers as pr', 'p.provider_id', '=', 'pr.id')
    ->where('c.slug', 'game')
    ->where(function ($q) {
        $q->where('pr.name', 'like', '%ALFAMART%')
            ->orWhere('pr.name', 'like', '%Steam%')
            ->orWhere('pr.name', 'like', '%INDOMARET%')
            ->orWhere('pr.name', 'like', '%Razer%')
            ->orWhere('pr.name', 'like', '%Garena%')
            ->orWhere('pr.name', 'like', '%PSN%')
            ->orWhere('pr.name', 'like', '%Google Play%');
    })
    ->select('p.sku_code', 'p.name', 'pr.name as brand', 'c.slug')
    ->limit(40)
    ->get();
foreach ($byProvider as $r) {
    echo json_encode($r, JSON_UNESCAPED_UNICODE)."\n";
}
echo 'count='.$byProvider->count()."\n";

echo "\nSample real game products still in game:\n";
$realGame = Product::query()
    ->with(['category', 'provider'])
    ->whereHas('category', fn ($q) => $q->where('slug', 'game'))
    ->where(function ($q) {
        $q->where('name', 'like', '%Mobile Legends%')
            ->orWhere('name', 'like', '%Free Fire%')
            ->orWhere('name', 'like', '%PUBG%')
            ->orWhere('name', 'like', '%Valorant%');
    })
    ->limit(5)
    ->get(['sku_code', 'name']);
foreach ($realGame as $p) {
    echo "  {$p->sku_code}: {$p->name}\n";
}

echo "\nCounts: game=".Product::whereHas('category', fn ($q) => $q->where('slug', 'game'))->count();
echo " voucher-digital=".Product::whereHas('category', fn ($q) => $q->where('slug', 'voucher-digital'))->count()."\n";
