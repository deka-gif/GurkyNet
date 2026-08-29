<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$rows = DB::table('products as p')
    ->join('providers as pr', 'p.provider_id', '=', 'pr.id')
    ->leftJoin('product_provider_skus as pps', 'pps.product_id', '=', 'p.id')
    ->leftJoin('product_providers as pp', 'pps.product_provider_id', '=', 'pp.id')
    ->where('pr.name', 'like', '%DANA%')
    ->where('p.status', 1)
    ->where('p.ops_status', 'active')
    ->select(
        'p.id',
        'p.sku_code',
        'p.name',
        'p.base_price',
        'pp.code as offer_provider',
        'pps.provider_sku',
        'pps.is_active as offer_active'
    )
    ->orderBy('p.name')
    ->get();

echo "Active DANA products:\n";
foreach ($rows as $r) {
    echo json_encode($r, JSON_UNESCAPED_UNICODE) . "\n";
}
