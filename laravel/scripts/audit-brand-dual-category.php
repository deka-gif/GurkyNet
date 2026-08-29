<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$brands = ['ALFAMART VOUCHER', 'Google Play Us Region', 'INDOMARET', 'RAZER GOLD', 'Steam Wallet Code', 'Voucher Garena Shell', 'Voucher PSN', 'Voucher Razer Gold'];
echo "=== Provider brands in GAME vs VOUCHER-DIGITAL ===\n";
foreach ($brands as $brand) {
    $game = DB::table('products as p')
        ->join('product_categories as c', 'p.product_category_id', '=', 'c.id')
        ->join('providers as pr', 'p.provider_id', '=', 'pr.id')
        ->where('c.slug', 'game')
        ->where('pr.name', $brand)
        ->count();
    $voucher = DB::table('products as p')
        ->join('product_categories as c', 'p.product_category_id', '=', 'c.id')
        ->join('providers as pr', 'p.provider_id', '=', 'pr.id')
        ->where('c.slug', 'voucher-digital')
        ->where('pr.name', $brand)
        ->count();
    echo "$brand: game=$game voucher-digital=$voucher\n";
}
