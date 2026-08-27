<?php

namespace App\Services\Payment;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

/**
 * Sprint 11 / SRS 16.5 + Bagian 17 — Midtrans credentials:
 * encrypted System Settings first, then env/config. Never log secrets.
 */
class MidtransCredentialResolver
{
    public const SERVER_KEY = 'payment_midtrans_server_key';

    public const CLIENT_KEY = 'payment_midtrans_client_key';

    public const IS_PRODUCTION = 'payment_midtrans_is_production';

    /**
     * @return array{
     *   server_key:string,
     *   client_key:string,
     *   is_production:bool,
     *   base_url:?string,
     *   snap_js_url:string,
     *   source:string
     * }
     */
    public function resolve(): array
    {
        $serverKey = $this->settingPlain(self::SERVER_KEY)
            ?: (string) (config('services.midtrans.server_key') ?? env('MIDTRANS_SERVER_KEY', ''));
        $clientKey = $this->settingPlain(self::CLIENT_KEY)
            ?: (string) (config('services.midtrans.client_key') ?? env('MIDTRANS_CLIENT_KEY', ''));

        $productionSetting = $this->settingPlain(self::IS_PRODUCTION);
        if ($productionSetting !== null) {
            $isProduction = filter_var($productionSetting, FILTER_VALIDATE_BOOLEAN);
        } else {
            $isProduction = (bool) (config('services.midtrans.is_production') ?? env('MIDTRANS_IS_PRODUCTION', false));
        }

        $configuredBase = config('services.midtrans.base_url') ?: env('MIDTRANS_BASE_URL');
        $baseUrl = $configuredBase ? rtrim((string) $configuredBase, '/') : null;

        $snapJsUrl = $isProduction
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js';

        $fromSettings = $this->settingPlain(self::SERVER_KEY) !== null
            || $this->settingPlain(self::CLIENT_KEY) !== null;

        return [
            'server_key' => $serverKey,
            'client_key' => $clientKey,
            'is_production' => $isProduction,
            'base_url' => $baseUrl,
            'snap_js_url' => $snapJsUrl,
            'source' => $fromSettings ? 'system_settings' : 'env_config',
        ];
    }

    /**
     * Public Snap bootstrap values — never includes server_key.
     *
     * @return array{client_key:string,is_production:bool,snap_js_url:string,configured:bool}
     */
    public function publicConfig(): array
    {
        $creds = $this->resolve();
        $placeholders = ['', 'dummy_server_key', 'dummy_client_key'];
        $configured = ! in_array($creds['server_key'], $placeholders, true)
            && ! in_array($creds['client_key'], $placeholders, true);

        return [
            'client_key' => $creds['client_key'],
            'is_production' => $creds['is_production'],
            'snap_js_url' => $creds['snap_js_url'],
            'configured' => $configured,
        ];
    }

    public function settingPlain(string $key): ?string
    {
        $row = SystemSetting::query()->where('key', $key)->first();
        if (! $row || $row->value === null || $row->value === '') {
            return null;
        }

        $sensitive = in_array($key, [self::SERVER_KEY, self::CLIENT_KEY], true);
        if (! $sensitive) {
            return (string) $row->value;
        }

        try {
            return Crypt::decryptString((string) $row->value);
        } catch (\Throwable $e) {
            Log::warning('Midtrans credential decrypt failed', [
                'key' => $key,
            ]);

            return null;
        }
    }
}
