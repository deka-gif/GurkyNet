<?php
/** Internal HTTP kernel test — same stack as real API request. */
$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);

$cats = ['game', 'voucher-digital', 'langganan-digital', 'international', 'topup-digital'];

foreach ($cats as $cat) {
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
    $count = is_array($body['data'] ?? null) ? count($body['data']) : 0;
    $success = ($body['success'] ?? false) ? 'true' : 'false';
    $status = $response->getStatusCode();
    echo "{$cat}: status={$status} success={$success} total={$total} data_count={$count} ms={$ms}\n";
    if ($status >= 500 || ($body['success'] ?? true) === false) {
        echo '  message=' . ($body['message'] ?? substr($response->getContent(), 0, 200)) . "\n";
    }
}

echo "DONE\n";
