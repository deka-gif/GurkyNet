<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        // Cached bootstrap config/routes from `artisan config:cache` override phpunit.xml
        // (APP_ENV, DB_CONNECTION, CACHE_STORE, etc.) and poison the suite against MySQL.
        $this->forgetCachedBootstrapFiles();

        parent::setUp();
        Cache::flush();

        // Prevent accidental live Digiflazz/Midtrans HTTP during sync-queue tests.
        // Individual tests may call Http::fake() again to override these defaults.
        Http::fake([
            'https://api.digiflazz.com/*' => Http::response([
                'data' => [
                    'ref_id' => 'TEST-REF',
                    'buyer_sku_code' => 'TEST',
                    'customer_no' => '081234567890',
                    'status' => 'Pending',
                    'message' => 'Pending',
                    'sn' => null,
                    'price' => 10000,
                    'deposit' => 1500000,
                ],
            ], 200),
            'https://app.sandbox.midtrans.com/*' => Http::response([
                'token' => 'test-snap-token',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/test',
            ], 200),
            'https://api.sandbox.midtrans.com/*' => Http::response([
                'status_code' => '200',
                'status_message' => 'Success',
                'transaction_status' => 'settlement',
            ], 200),
            'https://app.midtrans.com/*' => Http::response([
                'token' => 'test-snap-token',
                'redirect_url' => 'https://app.midtrans.com/snap/v2/vtweb/test',
            ], 200),
            'https://api.midtrans.com/*' => Http::response([
                'status_code' => '200',
                'status_message' => 'Success',
                'transaction_status' => 'settlement',
            ], 200),
        ]);
    }

    protected function forgetCachedBootstrapFiles(): void
    {
        $cacheDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'cache';

        foreach (['config.php', 'routes-v7.php', 'routes.php', 'events.php'] as $file) {
            $path = $cacheDir . DIRECTORY_SEPARATOR . $file;
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }
}
