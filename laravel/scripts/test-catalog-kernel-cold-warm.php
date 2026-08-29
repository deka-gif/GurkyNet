<?php
$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);

$cats = ['game', 'voucher-digital', 'langganan-digital', 'international', 'topup-digital'];

foreach ($cats as $cat) {
    foreach (['cold', 'warm'] as $run) {
        if ($run === 'cold') {
            \Illuminate\Support\Facades\Cache::forget(
                \App\Services\ProductProviders\ProductCatalogCache::searchKey(['category' => $cat, 'per_page' => 5000, 'page' => 1])
            );
        }
        $t0 = microtime(true);
        $request = \Illuminate\Http\Request::create(
            "/api/v1/products?category={$cat}&per_page=5000&page=1",
            'GET',
            [],
            [],
            [],
            ['HTTP_ACCEPT' => 'application/json', 'HTTP_HOST' => 'gurkynet.my.id']
        );
        $response = $kernel->handle($request);
        $ms = round((microtime(true) - $t0) * 1000);
        $body = json_decode($response->getContent(), true);
        $kernel->terminate($request, $response);
        $total = $body['pagination']['total'] ?? '?';
        $status = $response->getStatusCode();
        echo "{$cat} {$run}: status={$status} total={$total} ms={$ms}\n";
    }
}

echo "DONE\n";
