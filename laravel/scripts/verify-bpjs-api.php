<?php

$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

foreach (['bpjs-kesehatan', 'bpjs-tk'] as $cat) {
    echo "=== GET /api/v1/products?category={$cat} ===" . PHP_EOL;
    $request = Illuminate\Http\Request::create("/api/v1/products?category={$cat}&per_page=5000", 'GET');
    $response = app()->handle($request);
    $payload = json_decode($response->getContent(), true);
    $items = $payload['data'] ?? [];
    echo 'count=' . count($items) . PHP_EOL;
    foreach ($items as $item) {
        echo '  ' . ($item['code'] ?? '?') . ' | ' . ($item['name'] ?? '?') . PHP_EOL;
    }
    echo PHP_EOL;
}
