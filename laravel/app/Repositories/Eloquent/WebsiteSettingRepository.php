<?php

namespace App\Repositories\Eloquent;

use App\Models\WebsiteSetting;
use App\Repositories\Contracts\WebsiteSettingRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class WebsiteSettingRepository implements WebsiteSettingRepositoryInterface
{
    /** Relations to always eager-load so MediaResource resolves fresh URLs. */
    private const WITH = ['logoMedia', 'logoDarkMedia', 'faviconMedia'];

    public function all(): Collection
    {
        $settings = WebsiteSetting::with(self::WITH)->get();
        if ($settings->isEmpty()) {
            $default = $this->createDefault();
            return new Collection([$default]);
        }
        return $settings;
    }

    public function findById(int $id): ?WebsiteSetting
    {
        $setting = WebsiteSetting::with(self::WITH)->find($id);
        if (!$setting && $id === 1) {
            return $this->createDefault();
        }
        return $setting;
    }

    public function getLatest(): ?WebsiteSetting
    {
        try {
            $setting = WebsiteSetting::with(self::WITH)->latest('id')->first();
            if (!$setting) {
                return $this->createDefault();
            }
            return $setting;
        } catch (\Throwable $e) {
            report($e);
            return $this->createDefault();
        }
    }

    public function create(array $data): WebsiteSetting
    {
        $setting = WebsiteSetting::create($data);
        \App\Services\Website\PublicHomepageCache::forget(
            \App\Services\Website\CmsSyncService::SCOPE_SETTINGS,
            'website_settings_create'
        );

        // FR-MKT01 / FR-MKT04 — reuse Marketing audit (no second audit system).
        app(\App\Services\MarketingService::class)->logActivity('UPDATE_COMPANY_SETTINGS', [
            'action' => 'create',
            'setting_id' => $setting->id,
            'fields' => array_keys($data),
        ]);

        return $setting->load(self::WITH);
    }

    public function update(int $id, array $data): WebsiteSetting
    {
        $setting = WebsiteSetting::find($id);
        if (!$setting) {
            $data['id'] = $id;
            $setting = WebsiteSetting::create($data);
        } else {
            $setting->update($data);
        }
        \App\Services\Website\PublicHomepageCache::forget(
            \App\Services\Website\CmsSyncService::SCOPE_SETTINGS,
            'website_settings_update'
        );

        // FR-MKT01 / FR-MKT04 — company identity + logo fields.
        app(\App\Services\MarketingService::class)->logActivity('UPDATE_COMPANY_SETTINGS', [
            'action' => 'update',
            'setting_id' => $setting->id,
            'fields' => array_keys($data),
        ]);

        return $setting->load(self::WITH);
    }

    public function delete(int $id): bool
    {
        $setting = WebsiteSetting::find($id);
        if ($setting) {
            $deleted = (bool) $setting->delete();
            if ($deleted) {
                \App\Services\Website\PublicHomepageCache::forget(
                    \App\Services\Website\CmsSyncService::SCOPE_SETTINGS,
                    'website_settings_delete'
                );
            }

            return $deleted;
        }
        return false;
    }

    public function createDefault(): WebsiteSetting
    {
        try {
            $existing = WebsiteSetting::with(self::WITH)->latest('id')->first();
            if ($existing) {
                return $existing;
            }

            return WebsiteSetting::create([
                'website_name' => 'GurkyNet',
                'tagline' => 'Platform PPOB & Solusi Pembayaran Digital Tercepat di Indonesia',
                'logo' => '/assets/logo.png',
                'logo_dark' => '/assets/logo-dark.png',
                'favicon' => '/favicon.ico',
                'support_email' => 'support@gurkynet.com',
                'support_phone' => '+62 812-3456-7890',
                'whatsapp' => '6281234567890',
                'office_address' => 'Jl. Gatot Subroto No. 88, Kav. 12, Kuningan Barat, Mampang Prapatan, Jakarta Selatan, DKI Jakarta 12710',
                'google_maps_url' => 'https://maps.google.com/?q=Jakarta',
                'facebook' => 'https://facebook.com/gurkynet',
                'instagram' => 'https://instagram.com/gurkynet',
                'tiktok' => 'https://tiktok.com/@gurkynet',
                'youtube' => 'https://youtube.com/@gurkynet',
                'twitter' => 'https://x.com/gurkynet',
                'copyright' => '© 2026 PT Gurky Solusi Digital. Hak cipta dilindungi undang-undang.',
                'maintenance_mode' => false,
                'timezone' => 'Asia/Jakarta',
                'currency' => 'IDR',
                'language' => 'id',
            ])->load(self::WITH);
        } catch (\Throwable $e) {
            report($e);
            // Last resort in-memory model so callers never get null/exception.
            $fallback = new WebsiteSetting([
                'website_name' => 'GurkyNet',
                'tagline' => 'Platform PPOB & Solusi Pembayaran Digital Tercepat di Indonesia',
                'logo' => '/assets/logo.png',
                'logo_dark' => '/assets/logo-dark.png',
                'favicon' => '/favicon.ico',
                'support_email' => 'support@gurkynet.com',
                'support_phone' => '+62 812-3456-7890',
                'whatsapp' => '6281234567890',
                'maintenance_mode' => false,
                'timezone' => 'Asia/Jakarta',
                'currency' => 'IDR',
                'language' => 'id',
                'copyright' => '© 2026 PT Gurky Solusi Digital. Hak cipta dilindungi undang-undang.',
            ]);
            $fallback->id = 0;
            return $fallback;
        }
    }
}