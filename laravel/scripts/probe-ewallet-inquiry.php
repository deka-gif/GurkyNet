<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = App\Models\User::query()->find(17);
if (!$user) {
    echo "user 17 not found\n";
    exit(1);
}

try {
    $data = app(App\Services\Tagihan\TagihanInquiryService::class)
        ->inquireEwallet($user, 'VIP-DANA80', '081234567890');
    echo 'SUCCESS: ' . json_encode($data) . "\n";
} catch (Illuminate\Validation\ValidationException $e) {
    echo 'VALIDATION: ' . json_encode($e->errors(), JSON_UNESCAPED_UNICODE) . "\n";
} catch (Throwable $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
}
