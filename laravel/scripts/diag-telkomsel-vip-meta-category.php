<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;

$rows = DB::select("
    SELECT
        p.sku_code,
        p.name,
        JSON_UNQUOTE(JSON_EXTRACT(pps.provider_meta, '$.category')) AS vip_meta_category,
        JSON_UNQUOTE(JSON_EXTRACT(pps.provider_meta, '$.type')) AS vip_meta_type,
        pp.code AS source
    FROM products p
    INNER JOIN product_categories pc ON pc.id = p.product_category_id
    INNER JOIN providers pr ON pr.id = p.provider_id
    INNER JOIN product_provider_skus pps ON pps.product_id = p.id
    INNER JOIN product_providers pp ON pp.id = pps.product_provider_id
    WHERE p.deleted_at IS NULL
      AND pc.slug = 'voucher-internet'
      AND LOWER(pr.name) LIKE '%telkomsel%'
      AND pp.code = 'vip'
    ORDER BY p.name
");

$distinctMetaCat = [];
foreach ($rows as $r) {
    $k = $r->vip_meta_category ?? '(null)';
    $distinctMetaCat[$k] = ($distinctMetaCat[$k] ?? 0) + 1;
}

echo json_encode([
    'vip_telkomsel_voucher_internet_count' => count($rows),
    'distinct_vip_meta_category' => $distinctMetaCat,
    'sample_rows' => array_slice($rows, 0, 15),
    'rows_without_vip_meta_category' => array_values(array_filter($rows, fn ($r) => empty($r->vip_meta_category))),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
