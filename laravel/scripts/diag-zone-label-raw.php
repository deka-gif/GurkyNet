<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

if (! Schema::hasColumn('products', 'zone_label')) {
    echo "ERROR: column products.zone_label does not exist (migration not yet applied on this database).\n";
    exit(1);
}

echo "=== QUERY 1: zone_label counts ===\n";
$q1 = DB::select("
    SELECT zone_label, COUNT(*) AS jumlah_produk
    FROM products p
    JOIN product_categories c ON c.id = p.product_category_id
    JOIN providers pr ON pr.id = p.provider_id
    WHERE c.slug = 'voucher-internet'
      AND pr.name = 'Telkomsel'
      AND p.deleted_at IS NULL
    GROUP BY zone_label
    ORDER BY zone_label
");
foreach ($q1 as $row) {
    $label = $row->zone_label === null ? 'NULL' : $row->zone_label;
    echo $label . "\t" . $row->jumlah_produk . "\n";
}

echo "\n=== QUERY 2: zone_label + name ===\n";
$q2 = DB::select("
    SELECT zone_label, name
    FROM products p
    JOIN product_categories c ON c.id = p.product_category_id
    JOIN providers pr ON pr.id = p.provider_id
    WHERE c.slug = 'voucher-internet'
      AND pr.name = 'Telkomsel'
      AND p.deleted_at IS NULL
      AND zone_label IS NOT NULL
    ORDER BY zone_label, name
");
foreach ($q2 as $row) {
    echo $row->zone_label . "\t" . $row->name . "\n";
}
