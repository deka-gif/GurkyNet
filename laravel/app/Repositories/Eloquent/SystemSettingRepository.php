<?php

namespace App\Repositories\Eloquent;

use App\Models\SystemSetting;
use App\Repositories\Contracts\SystemSettingRepositoryInterface;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class SystemSettingRepository implements SystemSettingRepositoryInterface
{
    /**
     * List of keys that contain sensitive information and should be encrypted in DB.
     */
    protected $sensitiveKeys = [
        'email_smtp_password',
        'payment_midtrans_server_key',
        'payment_midtrans_client_key',
        'ppob_digiflazz_api_key',
        'ppob_digiflazz_webhook_secret',
    ];

    /**
     * Allowlisted setting keys that may be written via the admin API.
     */
    protected array $allowedKeys = [
        'app_name',
        'maintenance_mode',
        'default_margin',
        'email_smtp_host',
        'email_smtp_port',
        'email_smtp_username',
        'email_smtp_password',
        'email_from_address',
        'email_from_name',
        'payment_midtrans_server_key',
        'payment_midtrans_client_key',
        'payment_midtrans_is_production',
        'ppob_digiflazz_username',
        'ppob_digiflazz_api_key',
        'ppob_digiflazz_webhook_secret',
        'ppob_provider_priority',
        'notification_fcm_enabled',
        'support_email',
        'support_phone',
    ];

    public function getAll(): array
    {
        $settings = SystemSetting::all();
        $formatted = [];

        foreach ($settings as $setting) {
            $value = $setting->value;

            if (in_array($setting->key, $this->sensitiveKeys)) {
                try {
                    $value = $value ? Crypt::decryptString($value) : null;
                } catch (\Exception $e) {
                    $value = null; // If decryption fails
                }
            }

            $formatted[$setting->key] = $value;
        }

        return $formatted;
    }

    public function update(array $settings): array
    {
        DB::transaction(function () use ($settings) {
            foreach ($settings as $key => $value) {
                if (!in_array($key, $this->allowedKeys, true) && !in_array($key, $this->sensitiveKeys, true)) {
                    continue;
                }

                if (in_array($key, $this->sensitiveKeys) && !empty($value)) {
                    if ($value === '********') {
                        continue;
                    }
                    $value = Crypt::encryptString($value);
                }

                SystemSetting::updateOrCreate(
                    ['key' => $key],
                    ['value' => $value]
                );
            }
        });

        return $this->getAll();
    }
}
