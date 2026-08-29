<?php

$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Services\Catalog\ProductMappingService;

$m = app(ProductMappingService::class);
$cats = [
    'bpjs-kesehatan', 'bpjs-tk', 'pdam', 'internet-pascabayar', 'tv-pascabayar',
    'pbb', 'multifinance', 'gas', 'game', 'data', 'pulsa', 'topup-digital', 'voucher-digital', 'tagihan',
];

foreach ($cats as $cat) {
    $slugs = $m->filterSlugs($cat);
    $count = Product::query()
        ->join('product_categories', 'products.product_category_id', '=', 'product_categories.id')
        ->whereIn('product_categories.slug', $slugs)
        ->where('products.status', true)
        ->count();
    echo "{$cat}={$count}\n";
}
