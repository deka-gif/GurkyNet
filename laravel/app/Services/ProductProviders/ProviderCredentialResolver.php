<?php

namespace App\Services\ProductProviders;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

/**
 * Sprint 10 — resolve Digi/VIP credentials: System Settings (encrypted) first, then env/config.
 * Never logs secret values.
 */
class ProviderCredentialResolver
{
    public const DIGI_USERNAME = 'ppob_digiflazz_username';

    public const DIGI_API_KEY = 'ppob_digiflazz_api_key';

    public const DIGI_WEBHOOK_SECRET = 'ppob_digiflazz_webhook_secret';

    public const VIP_MERCHANT_ID = 'ppob_vip_merchant_id';

    public const VIP_API_KEY = 'ppob_vip_api_key';

    public const VIP_SIGNATURE = 'ppob_vip_signature';

    /**
     * @return array{username:string,api_key:string,base_url:string,webhook_secret:string,source:string}
     */
    public function digiflazz(): array
    {
        $username = $this->settingPlain(self::DIGI_USERNAME)
            ?: (string) (config('services.digiflazz.username') ?: env('DIGIFLAZZ_USERNAME', ''));
        $apiKey = $this->settingPlain(self::DIGI_API_KEY)
            ?: (string) (config('services.digiflazz.api_key') ?: env('DIGIFLAZZ_API_KEY', ''));
        $webhook = $this->settingPlain(self::DIGI_WEBHOOK_SECRET)
            ?: (string) (config('services.digiflazz.webhook_secret') ?: env('DIGIFLAZZ_WEBHOOK_SECRET', ''));
        $baseUrl = rtrim((string) (config('services.digiflazz.base_url') ?: env('DIGIFLAZZ_BASE_URL', 'https://api.digiflazz.com/v1')), '/');

        $fromSettings = $this->settingPlain(self::DIGI_USERNAME) !== null
            || $this->settingPlain(self::DIGI_API_KEY) !== null;

        return [
            'username' => $username,
            'api_key' => $apiKey,
            'base_url' => $baseUrl,
            'webhook_secret' => $webhook,
            'source' => $fromSettings ? 'system_settings' : 'env_config',
        ];
    }

    /**
     * @return array{api_id:string,api_key:string,signature:string,base_url:string,source:string}
     */
    public function vip(): array
    {
        $apiId = $this->settingPlain(self::VIP_MERCHANT_ID)
            ?: (string) (config('services.vip.username') ?: config('services.vip.merchant_id') ?: env('VIP_USERNAME', env('VIP_MERCHANT_ID', '')));
        $apiKey = $this->settingPlain(self::VIP_API_KEY)
            ?: (string) (config('services.vip.api_key') ?: env('VIP_API_KEY', ''));
        $signature = $this->settingPlain(self::VIP_SIGNATURE)
            ?: (string) (config('services.vip.signature') ?: env('VIP_SIGNATURE', ''));
        if ($signature === '' && $apiId !== '' && $apiKey !== '') {
            $signature = md5($apiId.$apiKey);
        }
        $baseUrl = rtrim((string) (config('services.vip.base_url') ?: env('VIP_BASE_URL', 'https://vip-reseller.co.id/api')), '/');

        $fromSettings = $this->settingPlain(self::VIP_MERCHANT_ID) !== null
            || $this->settingPlain(self::VIP_API_KEY) !== null;

        return [
            'api_id' => $apiId,
            'api_key' => $apiKey,
            'signature' => $signature,
            'base_url' => $baseUrl,
            'source' => $fromSettings ? 'system_settings' : 'env_config',
        ];
    }

    /**
     * Decrypt sensitive setting or return plain non-sensitive value. Null if missing.
     */
    public function settingPlain(string $key): ?string
    {
        $row = SystemSetting::query()->where('key', $key)->first();
        if (! $row || $row->value === null || $row->value === '') {
            return null;
        }

        $sensitive = in_array($key, [
            self::DIGI_API_KEY,
            self::DIGI_WEBHOOK_SECRET,
            self::VIP_API_KEY,
            self::VIP_SIGNATURE,
        ], true);

        if (! $sensitive) {
            return (string) $row->value;
        }

        try {
            return Crypt::decryptString((string) $row->value);
        } catch (\Throwable $e) {
            Log::warning('Provider credential decrypt failed', [
                'key' => $key,
                // Never log ciphertext or plaintext.
            ]);

            return null;
        }
    }
}
