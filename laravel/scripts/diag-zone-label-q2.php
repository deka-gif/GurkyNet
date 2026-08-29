<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
$rows = DB::select("SELECT zone_label, p.name AS name FROM products p JOIN product_categories c ON c.id = p.product_category_id JOIN providers pr ON pr.id = p.provider_id WHERE c.slug = 'voucher-internet' AND pr.name = 'Telkomsel' AND p.deleted_at IS NULL AND zone_label IS NOT NULL ORDER BY zone_label, p.name");
foreach ($rows as $r) {
    echo $r->zone_label . "\t" . $r->name . "\n";
}
