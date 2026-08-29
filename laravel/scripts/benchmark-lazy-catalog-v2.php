<?php
$base = '/var/www/GurkyNet/laravel';
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);

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

    return ['status' => $response->getStatusCode(), 'ms' => $ms, 'body' => $body];
}

echo "=== Lazy catalog benchmark (with real provider) ===\n";

$summary = benchHttp($kernel, '/api/v1/products/providers?category=game');
$providers = $summary['body']['data'] ?? [];
$first = $providers[0] ?? null;
echo "providers summary: status={$summary['status']} ms={$summary['ms']} count=" . count($providers) . "\n";

if ($first) {
    $pid = (int) $first['providerId'];
    $name = $first['name'];
    $prod = benchHttp($kernel, "/api/v1/products?category=game&provider_id={$pid}&per_page=5000");
    $total = $prod['body']['pagination']['total'] ?? count($prod['body']['data'] ?? []);
    echo "products for {$name} (id={$pid}): status={$prod['status']} ms={$prod['ms']} total={$total}\n";
}

$full = benchHttp($kernel, '/api/v1/products?category=game&per_page=5000');
$fullTotal = $full['body']['pagination']['total'] ?? 0;
echo "FULL game catalog (before pattern): status={$full['status']} ms={$full['ms']} total={$fullTotal}\n";

echo "DONE\n";
