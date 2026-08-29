<?php
$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\DigiflazzService;

$svc = app(DigiflazzService::class);
echo 'isConfigured=' . ($svc->isConfigured() ? 'true' : 'false') . PHP_EOL;

$customerNo = '56804464370';
echo "=== inquiryPln({$customerNo}) ===" . PHP_EOL;
try {
    $response = $svc->inquiryPln($customerNo);
    $data = $response['data'] ?? $response;
    $safe = is_array($data) ? $data : ['raw' => $data];
    // Redact nothing in data fields per user request (no credentials in data payload)
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
    echo PHP_EOL . '--- parsed fields ---' . PHP_EOL;
    if (is_array($data)) {
        foreach (['status', 'rc', 'customer_no', 'meter_no', 'subscriber_id', 'name', 'segment_power', 'message'] as $k) {
            echo "{$k}=" . json_encode($data[$k] ?? null, JSON_UNESCAPED_UNICODE) . PHP_EOL;
        }
        echo 'name_empty=' . (trim((string) ($data['name'] ?? '')) === '' ? 'true' : 'false') . PHP_EOL;
    }
} catch (Throwable $e) {
    echo 'EXCEPTION: ' . $e->getMessage() . PHP_EOL;
}
