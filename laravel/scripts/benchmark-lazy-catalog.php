<?php
/** Benchmark lazy catalog endpoints. Usage: php scripts/benchmark-lazy-catalog.php [provider_id] */
$base = is_dir('/var/www/GurkyNet/laravel') ? '/var/www/GurkyNet/laravel' : dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);

$providerId = isset($argv[1]) ? (int) $argv[1] : null;

function benchHttp($kernel, string $path): array
{
    $t0 = microtime(true);
    $request = \Illuminate\Http\Request::create($path, 'GET', [], [], [], [
        'HTTP_ACCEPT' => 'application/json',
        'HTTP_HOST' => 'gurkynet.my.id',
    ]);
    $response = $kernel->handle($request);
    $ms = round((microtime(true) - $t0) * 1000);
    $body = json_decode($response->getContent(), true);
    $kernel->terminate($request, $response);
    $count = is_array($body['data'] ?? null) ? count($body['data']) : 0;
    $total = $body['pagination']['total'] ?? $count;

    return [
        'status' => $response->getStatusCode(),
        'ms' => $ms,
        'count' => $count,
        'total' => $total,
        'success' => ($body['success'] ?? false) ? 'true' : 'false',
    ];
}

echo "=== Lazy catalog benchmark ===\n";

foreach (['game', 'voucher-digital', 'topup-digital'] as $cat) {
    $r = benchHttp($kernel, "/api/v1/products/providers?category={$cat}");
    echo "GET /products/providers?category={$cat}: status={$r['status']} ms={$r['ms']} providers={$r['count']}\n";
}

$gameProvider = $providerId ?: 1;
$r = benchHttp($kernel, "/api/v1/products?category=game&provider_id={$gameProvider}&per_page=5000");
echo "GET /products?category=game&provider_id={$gameProvider}: status={$r['status']} ms={$r['ms']} total={$r['total']}\n";

$r2 = benchHttp($kernel, '/api/v1/products?category=topup-digital&per_page=5000');
echo "GET /products?category=topup-digital (control): status={$r2['status']} ms={$r2['ms']} total={$r2['total']}\n";

echo "DONE\n";
