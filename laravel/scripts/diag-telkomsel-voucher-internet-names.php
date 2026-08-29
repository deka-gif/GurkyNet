<?php

/**
 * Read-only diagnostic: Telkomsel voucher-internet product names (production).
 * Does not modify any data.
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

function telkomselProviderMatchSql(string $column): string
{
    return "LOWER(REPLACE(REPLACE(REPLACE({$column}, ' ', ''), '-', ''), '.', '')) LIKE '%telkomsel%'";
}

$masterRows = DB::select("
    SELECT
        p.id,
        p.sku_code,
        p.name,
        p.sell_price,
        p.base_price,
        p.admin_fee,
        p.status,
        p.ops_status,
        p.category_mapping_source,
        pc.slug AS category_slug,
        pc.name AS category_name,
        pr.id AS provider_id,
        pr.name AS provider_name
    FROM products p
    INNER JOIN product_categories pc ON pc.id = p.product_category_id
    LEFT JOIN providers pr ON pr.id = p.provider_id
    WHERE p.deleted_at IS NULL
      AND pc.slug = 'voucher-internet'
      AND (" . telkomselProviderMatchSql('pr.name') . ")
    ORDER BY p.name ASC, p.sku_code ASC
");

$digiRows = DB::select("
    SELECT
        dp.buyer_sku_code,
        dp.product_name,
        dp.category,
        dp.brand,
        dp.type,
        dp.desc,
        dp.seller_price,
        dp.buyer_product_status,
        dp.seller_product_status,
        dp.list_type,
        dp.multi,
        dp.stock
    FROM digiflazz_products dp
    INNER JOIN products p ON p.sku_code = dp.buyer_sku_code AND p.deleted_at IS NULL
    INNER JOIN product_categories pc ON pc.id = p.product_category_id
    WHERE pc.slug = 'voucher-internet'
      AND (" . telkomselProviderMatchSql('dp.brand') . ")
    ORDER BY dp.product_name ASC, dp.buyer_sku_code ASC
");

$skuMetaSample = DB::select("
    SELECT
        p.sku_code,
        p.name,
        pps.provider_sku,
        pps.provider_meta,
        pps.is_active AS sku_mapping_active,
        pp.code AS product_provider_code
    FROM products p
    INNER JOIN product_categories pc ON pc.id = p.product_category_id
    LEFT JOIN providers pr ON pr.id = p.provider_id
    LEFT JOIN product_provider_skus pps ON pps.product_id = p.id
    LEFT JOIN product_providers pp ON pp.id = pps.product_provider_id
    WHERE p.deleted_at IS NULL
      AND pc.slug = 'voucher-internet'
      AND (" . telkomselProviderMatchSql('pr.name') . ")
    ORDER BY p.name ASC
    LIMIT 5
");

$distinctDigiTypes = DB::select("
    SELECT dp.type, COUNT(*) AS cnt
    FROM digiflazz_products dp
    INNER JOIN products p ON p.sku_code = dp.buyer_sku_code AND p.deleted_at IS NULL
    INNER JOIN product_categories pc ON pc.id = p.product_category_id
    WHERE pc.slug = 'voucher-internet'
      AND (" . telkomselProviderMatchSql('dp.brand') . ")
    GROUP BY dp.type
    ORDER BY cnt DESC
");

$distinctDigiCategories = DB::select("
    SELECT dp.category, COUNT(*) AS cnt
    FROM digiflazz_products dp
    INNER JOIN products p ON p.sku_code = dp.buyer_sku_code AND p.deleted_at IS NULL
    INNER JOIN product_categories pc ON pc.id = p.product_category_id
    WHERE pc.slug = 'voucher-internet'
      AND (" . telkomselProviderMatchSql('dp.brand') . ")
    GROUP BY dp.category
    ORDER BY cnt DESC
");

$distinctNames = [];
foreach ($masterRows as $row) {
    $distinctNames[$row->name] = true;
}

$providerNames = DB::select("
    SELECT DISTINCT pr.name
    FROM products p
    INNER JOIN product_categories pc ON pc.id = p.product_category_id
    LEFT JOIN providers pr ON pr.id = p.provider_id
    WHERE p.deleted_at IS NULL
      AND pc.slug = 'voucher-internet'
      AND (" . telkomselProviderMatchSql('pr.name') . ")
    ORDER BY pr.name
");

echo json_encode([
    'query_notes' => [
        'frontend_operatorName_source' => 'providers.name via ProductResource (same as Digiflazz brand at sync time)',
        'category_filter' => "product_categories.slug = 'voucher-internet'",
        'telkomsel_filter' => 'providers.name / digiflazz_products.brand normalized LIKE %telkomsel% (matches operatorMatch.ts telkomsel key)',
    ],
    'provider_name_values_found' => array_map(fn ($r) => $r->name, $providerNames),
    'master_products_count' => count($masterRows),
    'distinct_product_names_count' => count($distinctNames),
    'distinct_product_names' => array_keys($distinctNames),
    'master_products' => $masterRows,
    'digiflazz_mirror_count' => count($digiRows),
    'digiflazz_mirror_rows' => $digiRows,
    'digiflazz_distinct_type_values' => $distinctDigiTypes,
    'digiflazz_distinct_category_values' => $distinctDigiCategories,
    'product_provider_skus_meta_sample' => $skuMetaSample,
    'raw_source_tables' => [
        'products' => ['id', 'sku_code', 'name', 'sell_price', 'base_price', 'admin_fee', 'status', 'ops_status', 'category_mapping_source', 'provider_id', 'product_category_id'],
        'providers' => ['id', 'name', 'logo', 'is_active'],
        'product_categories' => ['id', 'slug', 'name'],
        'digiflazz_products' => ['buyer_sku_code', 'product_name', 'category', 'brand', 'type', 'desc', 'seller_price', 'list_type', 'multi', 'stock', 'buyer_product_status', 'seller_product_status'],
        'product_provider_skus' => ['provider_sku', 'provider_meta (json, nullable — populated for VIP sync; Digiflazz rows typically null)'],
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
