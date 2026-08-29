<?php

/**
 * Read-only audit: voucher-internet elektronik transactions with potential qty>1 mismatch.
 * Does not modify any data.
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$qtyGt1 = DB::selectOne("
    SELECT COUNT(*) AS cnt
    FROM transactions t
    JOIN transaction_items ti ON ti.transaction_id = t.id
    JOIN products p ON p.sku_code = ti.product_code
    JOIN product_categories c ON c.id = p.product_category_id
    WHERE c.slug = 'voucher-internet'
      AND t.deleted_at IS NULL
      AND ti.quantity > 1
");

$evoucherCount = DB::selectOne("
    SELECT COUNT(*) AS cnt
    FROM transactions t
    JOIN transaction_items ti ON ti.transaction_id = t.id
    JOIN products p ON p.sku_code = ti.product_code
    JOIN product_categories c ON c.id = p.product_category_id
    WHERE c.slug = 'voucher-internet'
      AND t.deleted_at IS NULL
      AND t.target_number = 'EVOUCHER'
");

$amountMismatch = DB::select("
    SELECT t.id, t.invoice_number, t.total_payment, ti.price AS item_price, ti.quantity,
           t.target_number, t.status, t.created_at
    FROM transactions t
    JOIN transaction_items ti ON ti.transaction_id = t.id
    JOIN products p ON p.sku_code = ti.product_code
    JOIN product_categories c ON c.id = p.product_category_id
    WHERE c.slug = 'voucher-internet'
      AND t.deleted_at IS NULL
      AND t.target_number = 'EVOUCHER'
      AND ABS(t.total_payment - (ti.price * ti.quantity)) > 0.01
    ORDER BY t.created_at DESC
    LIMIT 50
");

$multiUnitSuspects = DB::select("
    SELECT t.id, t.invoice_number, t.total_payment, ti.price AS unit_price, ti.quantity,
           p.sku_code, t.target_number, t.status, t.created_at,
           ROUND(t.total_payment / NULLIF(ti.price, 0), 2) AS payment_ratio
    FROM transactions t
    JOIN transaction_items ti ON ti.transaction_id = t.id
    JOIN products p ON p.sku_code = ti.product_code
    JOIN product_categories c ON c.id = p.product_category_id
    WHERE c.slug = 'voucher-internet'
      AND t.deleted_at IS NULL
      AND t.target_number = 'EVOUCHER'
      AND ti.quantity = 1
      AND ti.price > 0
      AND MOD(t.total_payment, ti.price) = 0
      AND t.total_payment > ti.price + 0.01
    ORDER BY t.created_at DESC
    LIMIT 50
");

$metadataQtyHints = DB::select("
    SELECT t.id, t.invoice_number, ti.custom_metadata, t.total_payment, ti.price, t.created_at
    FROM transactions t
    JOIN transaction_items ti ON ti.transaction_id = t.id
    JOIN products p ON p.sku_code = ti.product_code
    JOIN product_categories c ON c.id = p.product_category_id
    WHERE c.slug = 'voucher-internet'
      AND t.deleted_at IS NULL
      AND t.target_number = 'EVOUCHER'
      AND (
        JSON_UNQUOTE(JSON_EXTRACT(ti.custom_metadata, '$.Qty')) IN ('2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20')
        OR JSON_UNQUOTE(JSON_EXTRACT(ti.custom_metadata, '$.qty')) IN ('2','3','4','5','6','7','8','9','10')
        OR JSON_UNQUOTE(JSON_EXTRACT(ti.custom_metadata, '$.Mode')) = 'elektronik'
      )
    ORDER BY t.created_at DESC
    LIMIT 20
");

$totalVi = DB::selectOne("
    SELECT COUNT(*) AS cnt
    FROM transactions t
    JOIN transaction_items ti ON ti.transaction_id = t.id
    JOIN products p ON p.sku_code = ti.product_code
    JOIN product_categories c ON c.id = p.product_category_id
    WHERE c.slug = 'voucher-internet'
      AND t.deleted_at IS NULL
");

echo json_encode([
    'total_voucher_internet_transactions' => (int) ($totalVi->cnt ?? 0),
    'qty_gt_1_count' => (int) ($qtyGt1->cnt ?? 0),
    'evoucher_target_count' => (int) ($evoucherCount->cnt ?? 0),
    'evoucher_amount_mismatch_count' => count($amountMismatch),
    'evoucher_amount_mismatch_samples' => $amountMismatch,
    'multi_unit_payment_ratio_suspects_count' => count($multiUnitSuspects),
    'multi_unit_payment_ratio_suspects_samples' => $multiUnitSuspects,
    'metadata_qty_or_mode_samples' => $metadataQtyHints,
], JSON_PRETTY_PRINT) . PHP_EOL;
