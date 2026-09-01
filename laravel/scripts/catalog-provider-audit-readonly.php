<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Models\ProductProvider;
use App\Services\ProductProviders\LogicalProductKey;

$digi = ProductProvider::digiflazz()?->id;
$vip = ProductProvider::vip()?->id;
$cats = ['pulsa', 'data', 'game', 'topup-digital', 'voucher-digital', 'pln', 'langganan-digital'];

echo "=== Catalog Provider Audit (read-only) ===\n";
echo 'Digi ID: '.$digi.' VIP ID: '.$vip."\n\n";

$grand = ['active' => 0, 'digi_only' => 0, 'vip_only' => 0, 'both' => 0, 'no_map' => 0, 'dup_groups' => 0];

foreach ($cats as $slug) {
    $products = Product::query()
        ->whereNull('deleted_at')
        ->where('status', true)
        ->whereHas('category', fn ($c) => $c->where('slug', $slug))
        ->with(['category', 'provider', 'providerSkus'])
        ->get();

    $onlyDigi = 0;
    $onlyVip = 0;
    $both = 0;
    $none = 0;
    $groups = [];

    foreach ($products as $p) {
        $skus = $p->providerSkus->where('is_active', true);
        $hasD = $digi && $skus->contains(fn ($s) => (int) $s->product_provider_id === $digi && trim((string) $s->provider_sku) !== '');
        $hasV = $vip && $skus->contains(fn ($s) => (int) $s->product_provider_id === $vip && trim((string) $s->provider_sku) !== '');
        if ($hasD && $hasV) {
            $both++;
        } elseif ($hasD) {
            $onlyDigi++;
        } elseif ($hasV) {
            $onlyVip++;
        } else {
            $none++;
        }
        $groups[LogicalProductKey::groupKey($p)] = ($groups[LogicalProductKey::groupKey($p)] ?? 0) + 1;
    }

    $dup = collect($groups)->filter(fn ($c) => $c > 1)->count();
    $grand['active'] += $products->count();
    $grand['digi_only'] += $onlyDigi;
    $grand['vip_only'] += $onlyVip;
    $grand['both'] += $both;
    $grand['no_map'] += $none;
    $grand['dup_groups'] += $dup;

    echo sprintf(
        "%-18s active=%-5d digi_only=%-5d vip_only=%-5d both=%-4d no_map=%-5d dup_groups=%d\n",
        $slug,
        $products->count(),
        $onlyDigi,
        $onlyVip,
        $both,
        $none,
        $dup
    );
}

echo "\nTOTAL: ".json_encode($grand, JSON_PRETTY_PRINT)."\n";
