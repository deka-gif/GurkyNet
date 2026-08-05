<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BannerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $rawPath = $this->imageMedia
            ? $this->imageMedia->getRawOriginal('url')
            : $this->image_url;

        $imageUrl = \App\Support\MediaUrl::absolute($rawPath);

        return [
            'id' => (string) $this->id,
            'type' => $this->type ?? 'banner',
            'title' => $this->title,
            'description' => $this->description ?? '',
            // Primary display fields (absolute, API-served)
            'image' => $imageUrl ?: '',
            'imageUrl' => $imageUrl ?: '',
            'image_url' => $imageUrl ?: '',
            'thumbnail_url' => $imageUrl ?: '',
            'mobileImage' => $this->mobileImageMedia ? new MediaResource($this->mobileImageMedia) : null,
            'imageMedia' => $this->imageMedia ? new MediaResource($this->imageMedia) : null,
            'imageMediaId' => $this->image_media_id,
            'mobileImageMediaId' => $this->mobile_image_media_id,
            'redirectUrl' => $this->redirect_url,
            'promoCode' => $this->code,
            'isActive' => (bool) $this->is_active,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
