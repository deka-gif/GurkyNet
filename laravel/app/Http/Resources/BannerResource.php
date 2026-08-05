<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BannerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $imageUrl = \App\Support\MediaUrl::absolute(
            $this->imageMedia ? $this->imageMedia->url : $this->image_url
        );

        return [
            'id' => (string) $this->id,
            'type' => $this->type ?? 'banner',
            'title' => $this->title,
            'description' => $this->description ?? '',
            'image' => $imageUrl ?: '',
            'imageUrl' => $imageUrl ?: '',
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
