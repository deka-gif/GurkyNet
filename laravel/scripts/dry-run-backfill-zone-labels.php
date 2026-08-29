<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\DigiflazzProduct;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Services\Catalog\VoucherInternetZoneLabelResolver;
use Illuminate\Support\Facades\DB;

$resolver = app(VoucherInternetZoneLabelResolver::class);
$vipId = ProductProvider::query()->where('code', 'vip')->value('id');

$rows = DB::select("
    SELECT p.id, p.sku_code, p.name
    FROM products p
    INNER JOIN product_categories pc ON pc.id = p.product_category_id
    INNER JOIN providers pr ON pr.id = p.provider_id
    WHERE p.deleted_at IS NULL
      AND pc.slug = 'voucher-internet'
      AND LOWER(pr.name) LIKE '%telkomsel%'
");

$filled = 0;
$nulled = 0;
$samples = ['filled' => [], 'null' => []];

foreach ($rows as $row) {
    $label = null;
    if ($vipId) {
        $meta = ProductProviderSku::query()
            ->where('product_id', $row->id)
            ->where('product_provider_id', $vipId)
            ->value('provider_meta');
        if (is_string($meta)) {
            $meta = json_decode($meta, true);
        }
        $label = $resolver->fromVipProviderMeta(is_array($meta) ? $meta : null, $row->name);
    }
    if ($label === null) {
        $digiType = DigiflazzProduct::query()->where('buyer_sku_code', $row->sku_code)->value('type');
        $label = $resolver->fromDigiflazzType($digiType, $row->name);
    }
    if ($label === null) {
        $nulled++;
        if (count($samples['null']) < 10) {
            $samples['null'][] = ['sku' => $row->sku_code, 'name' => $row->name];
        }
    } else {
        $filled++;
        if (count($samples['filled']) < 5) {
            $samples['filled'][] = ['sku' => $row->sku_code, 'zone_label' => $label];
        }
    }
}

echo json_encode([
    'total_telkomsel_voucher_internet' => count($rows),
    'would_set_zone_label' => $filled,
    'would_remain_null' => $nulled,
    'samples' => $samples,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
