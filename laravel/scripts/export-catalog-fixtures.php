<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Repositories\Contracts\ProductRepositoryInterface;

$repo = app(ProductRepositoryInterface::class);

foreach (['game', 'voucher-digital'] as $category) {
    $page = $repo->getPaginatedProducts(['category' => $category, 'per_page' => 5000]);
    $out = ['success' => true, 'data' => []];
    foreach ($page->items() as $p) {
        $out['data'][] = [
            'id' => $p->id,
            'code' => $p->sku_code,
            'name' => $p->name,
            'price' => (float) $p->sell_price,
            'operatorName' => $p->provider?->name,
            'category' => $p->category?->slug,
            'status' => (bool) $p->status,
            'ops_status' => $p->ops_status ?? 'active',
        ];
    }
    $path = sys_get_temp_dir()."/products-{$category}.json";
    file_put_contents($path, json_encode($out));
    echo "Wrote {$path} count=".count($out['data'])."\n";
}
