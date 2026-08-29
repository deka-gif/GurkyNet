<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$patterns = ['ALFAMART', 'Steam Wallet', 'INDOMARET', 'RAZER GOLD', 'Garena Shell', 'PSN', 'Google Play'];
echo "=== All products matching Owner-reported names ===\n";
$rows = DB::table('products as p')
    ->join('product_categories as c', 'p.product_category_id', '=', 'c.id')
    ->join('providers as pr', 'p.provider_id', '=', 'pr.id')
    ->where(function ($q) use ($patterns) {
        foreach ($patterns as $pat) {
            $q->orWhere('p.name', 'like', '%'.$pat.'%')
                ->orWhere('pr.name', 'like', '%'.$pat.'%');
        }
    })
    ->select('p.sku_code', 'p.name', 'pr.name as brand', 'c.slug', 'p.category_mapping_source')
    ->orderBy('c.slug')
    ->orderBy('p.name')
    ->limit(60)
    ->get();

foreach ($rows as $r) {
    echo json_encode($r, JSON_UNESCAPED_UNICODE)."\n";
}
echo 'total='.$rows->count()."\n";
