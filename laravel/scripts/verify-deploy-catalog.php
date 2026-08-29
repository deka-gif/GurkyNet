<?php
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$repo = app(\App\Repositories\Contracts\ProductRepositoryInterface::class);

foreach (['topup-digital', 'game', 'data', 'pulsa', 'voucher-digital'] as $cat) {
    $count = $repo->getActiveProductsForCategory($cat)->count();
    $bebas = \App\Models\Product::where('name', 'like', '%Bebas Nominal%')->count();
    echo "{$cat} visible={$count}\n";
}
echo "bebas_nominal_total={$bebas}\n";
foreach (\App\Models\Product::where('name', 'like', '%Bebas Nominal%')->get(['sku_code', 'name']) as $p) {
    echo "  - {$p->sku_code} {$p->name}\n";
}
