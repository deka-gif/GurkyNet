<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Repositories\Contracts\ProductRepositoryInterface;

$repo = app(ProductRepositoryInterface::class);
$page = $repo->getPaginatedProducts(['category' => 'game', 'per_page' => 5000, 'page' => 1]);

$bad = ['ALFAMART', 'STEAM', 'INDOMARET', 'RAZER GOLD', 'GARENA SHELL', 'PSN', 'GOOGLE PLAY'];
$ops = collect();
foreach ($page->items() as $product) {
    $ops->push($product->provider?->name ?? '');
}

$unique = $ops->filter()->unique()->sort()->values();
echo "Game catalog operators ({$unique->count()}):\n";
foreach ($unique as $op) {
    $upper = strtoupper((string) $op);
    $flag = false;
    foreach ($bad as $b) {
        if (str_contains($upper, $b)) {
            $flag = true;
            break;
        }
    }
    echo ($flag ? '  BAD: ' : '  OK:  ').$op."\n";
}

echo "\nBad products in game catalog response:\n";
foreach ($page->items() as $product) {
    $name = strtoupper((string) $product->name);
    $op = strtoupper((string) ($product->provider?->name ?? ''));
    foreach ($bad as $b) {
        if (str_contains($name, $b) || str_contains($op, $b)) {
            echo "  {$product->sku_code} | {$product->provider?->name} | {$product->name} | cat={$product->category?->slug}\n";
            break;
        }
    }
}

echo "\nTotal products in game page: ".$page->total()."\n";
