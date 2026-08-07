<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Schema;

class WebsiteSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $logoMedia = null;
        $logoDarkMedia = null;
        $faviconMedia = null;

        try {
            $logoMedia = $this->logoMedia;
        } catch (\Throwable) {
            $logoMedia = null;
        }
        try {
            $logoDarkMedia = $this->logoDarkMedia;
        } catch (\Throwable) {
            $logoDarkMedia = null;
        }
        try {
            $faviconMedia = $this->faviconMedia;
        } catch (\Throwable) {
            $faviconMedia = null;
        }

        $apkUrl = null;
        try {
            if (Schema::hasColumn('website_settings', 'apk_url')) {
                $apkUrl = $this->apk_url;
            }
        } catch (\Throwable) {
            $apkUrl = null;
        }

        return [
            'id' => $this->id ?? 0,
            'websiteName' => $this->website_name ?? 'GurkyNet',
            'tagline' => $this->tagline,
            'logo' => $logoMedia ? new MediaResource($logoMedia) : ($this->logo ?? null),
            'logoDark' => $logoDarkMedia ? new MediaResource($logoDarkMedia) : ($this->logo_dark ?? null),
            'favicon' => $faviconMedia ? new MediaResource($faviconMedia) : ($this->favicon ?? null),
            'apkUrl' => $apkUrl,
            'logoMediaId' => $this->logo_media_id ?? null,
            'logoDarkMediaId' => $this->logo_dark_media_id ?? null,
            'faviconMediaId' => $this->favicon_media_id ?? null,
            'supportEmail' => $this->support_email ?? null,
            'supportPhone' => $this->support_phone ?? null,
            'whatsapp' => $this->whatsapp ?? null,
            'officeAddress' => $this->office_address ?? null,
            'googleMapsUrl' => $this->google_maps_url ?? null,
            'facebook' => $this->facebook ?? null,
            'instagram' => $this->instagram ?? null,
            'tiktok' => $this->tiktok ?? null,
            'youtube' => $this->youtube ?? null,
            'twitter' => $this->twitter ?? null,
            'copyright' => $this->copyright ?? null,
            'maintenanceMode' => (bool) ($this->maintenance_mode ?? false),
            'timezone' => $this->timezone ?? 'Asia/Jakarta',
            'currency' => $this->currency ?? 'IDR',
            'language' => $this->language ?? 'id',
            'seoTitle' => $this->seo_title ?? null,
            'seoDescription' => $this->seo_description ?? null,
            'seoKeywords' => $this->seo_keywords ?? null,
            'createdAt' => optional($this->created_at)?->toIso8601String(),
            'lastUpdated' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
