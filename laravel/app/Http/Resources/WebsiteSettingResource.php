<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebsiteSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'websiteName' => $this->website_name,
            'tagline' => $this->tagline,
            'logo' => $this->logoMedia ? new MediaResource($this->logoMedia) : $this->logo,
            'logoDark' => $this->logoDarkMedia ? new MediaResource($this->logoDarkMedia) : $this->logo_dark,
            'favicon' => $this->faviconMedia ? new MediaResource($this->faviconMedia) : $this->favicon,
            'apkUrl' => $this->apk_url,
            'logoMediaId' => $this->logo_media_id,
            'logoDarkMediaId' => $this->logo_dark_media_id,
            'faviconMediaId' => $this->favicon_media_id,
            'supportEmail' => $this->support_email,
            'supportPhone' => $this->support_phone,
            'whatsapp' => $this->whatsapp,
            'officeAddress' => $this->office_address,
            'googleMapsUrl' => $this->google_maps_url,
            'facebook' => $this->facebook,
            'instagram' => $this->instagram,
            'tiktok' => $this->tiktok,
            'youtube' => $this->youtube,
            'twitter' => $this->twitter,
            'copyright' => $this->copyright,
            'maintenanceMode' => (bool) $this->maintenance_mode,
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'language' => $this->language,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
