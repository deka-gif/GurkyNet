<?php

$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\Catalog\ProductMappingService;
use Illuminate\Support\Facades\DB;

$mapping = app(ProductMappingService::class);

echo "=== AXIS samples (digiflazz_products) ===\n";
$axis = DB::table('digiflazz_products')
    ->where(function ($q) {
        $q->where('brand', 'like', '%AXIS%')->orWhere('brand', 'like', '%Axis%');
    })
    ->select('category', 'brand', 'product_name')
    ->limit(20)
    ->get();
foreach ($axis as $r) {
    $m = $mapping->map('digiflazz', $r->category, $r->brand, $r->product_name);
    echo "{$r->category} | {$r->brand} | {$r->product_name}\n";
    echo "  -> slug={$m['slug']} source={$m['source']}\n";
}

echo "\n=== Telkomsel Voucher category samples ===\n";
$tsel = DB::table('digiflazz_products')
    ->where('brand', 'like', '%Telkomsel%')
    ->where('category', 'like', '%Voucher%')
    ->select('category', 'brand', 'product_name')
    ->limit(15)
    ->get();
foreach ($tsel as $r) {
    $m = $mapping->map('digiflazz', $r->category, $r->brand, $r->product_name);
    echo "{$r->category} | {$r->brand} | {$r->product_name}\n";
    echo "  -> slug={$m['slug']} source={$m['source']}\n";
}

echo "\n=== Misplaced telco in topup-digital / voucher-digital ===\n";
$telcoNames = ['AXIS', 'Axis', 'Telkomsel', 'Indosat', 'XL', 'Tri', 'Smartfren', 'by.U', 'byU'];
$rows = DB::table('products')
    ->join('product_categories', 'products.product_category_id', '=', 'product_categories.id')
    ->join('providers', 'products.provider_id', '=', 'providers.id')
    ->whereIn('product_categories.slug', ['topup-digital', 'voucher-digital'])
    ->where(function ($q) use ($telcoNames) {
        foreach ($telcoNames as $name) {
            $q->orWhere('providers.name', 'like', "%{$name}%");
        }
    })
    ->select('providers.name as brand', 'product_categories.slug', 'products.name', 'products.category_mapping_source', DB::raw('count(*) as c'))
    ->groupBy('providers.name', 'product_categories.slug', 'products.name', 'products.category_mapping_source')
    ->orderByDesc('c')
    ->limit(30)
    ->get();
foreach ($rows as $r) {
    echo "{$r->brand} | {$r->slug} | source={$r->category_mapping_source} | {$r->name} x{$r->c}\n";
}

echo "\n=== Products by source (name_keyword / unmapped_fallback) top 30 ===\n";
$sources = DB::table('products')
    ->join('product_categories', 'products.product_category_id', '=', 'product_categories.id')
    ->whereIn('products.category_mapping_source', ['name_keyword', 'unmapped_fallback'])
    ->select('product_categories.slug', 'products.category_mapping_source', DB::raw('count(*) as c'))
    ->groupBy('product_categories.slug', 'products.category_mapping_source')
    ->orderByDesc('c')
    ->limit(30)
    ->get();
foreach ($sources as $r) {
    echo "{$r->category_mapping_source} -> {$r->slug} x{$r->c}\n";
}

echo "\n=== E-wallet flexible (multi) SKUs ===\n";
$ewalletMulti = DB::table('digiflazz_products')
    ->where(function ($q) {
        $q->where('category', 'like', '%money%')
            ->orWhere('category', 'like', '%Money%')
            ->orWhere('category', 'E-Money');
    })
    ->where('multi', true)
    ->where('buyer_product_status', true)
    ->select('brand', 'product_name', 'category', 'seller_price', 'multi')
    ->limit(15)
    ->get();
echo 'Active e-money multi=true count: ' . $ewalletMulti->count() . "\n";
foreach ($ewalletMulti as $r) {
    echo "{$r->category} | {$r->brand} | {$r->product_name} | multi={$r->multi}\n";
}

echo "\n=== International category count ===\n";
$intl = DB::table('products')
    ->join('product_categories', 'products.product_category_id', '=', 'product_categories.id')
    ->where('product_categories.slug', 'international')
    ->where('products.status', 1)
    ->count();
echo "Active international products: {$intl}\n";

echo "\n=== Active topup-digital providers (top 15) ===\n";
$ewallets = DB::table('products')
    ->join('product_categories', 'products.product_category_id', '=', 'product_categories.id')
    ->join('providers', 'products.provider_id', '=', 'providers.id')
    ->where('product_categories.slug', 'topup-digital')
    ->where('products.status', 1)
    ->select('providers.name', DB::raw('count(*) as c'))
    ->groupBy('providers.name')
    ->orderByDesc('c')
    ->limit(15)
    ->get();
foreach ($ewallets as $r) {
    echo "{$r->name} x{$r->c}\n";
}
