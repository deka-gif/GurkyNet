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

        $mobileRaw = $this->mobileImageMedia
            ? $this->mobileImageMedia->getRawOriginal('url')
            : null;
        $mobileUrl = $mobileRaw ? \App\Support\MediaUrl::absolute($mobileRaw) : null;

        $status = $this->resolveScheduleStatus();

        return [
            'id' => (string) $this->id,
            'type' => $this->type ?? 'banner',
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description ?? '',
            'terms' => $this->terms,
            // Primary display fields (absolute, API-served)
            'image' => $imageUrl ?: '',
            'imageUrl' => $imageUrl ?: '',
            'image_url' => $imageUrl ?: '',
            'thumbnail_url' => $imageUrl ?: '',
            'mobileImageUrl' => $mobileUrl ?: $imageUrl ?: '',
            'mobile_image_url' => $mobileUrl ?: $imageUrl ?: '',
            'mobileImage' => $this->mobileImageMedia ? new MediaResource($this->mobileImageMedia) : null,
            'imageMedia' => $this->imageMedia ? new MediaResource($this->imageMedia) : null,
            'imageMediaId' => $this->image_media_id,
            'mobileImageMediaId' => $this->mobile_image_media_id,
            'redirectUrl' => $this->redirect_url,
            'ctaUrl' => $this->redirect_url,
            'ctaLabel' => $this->cta_label,
            'promoCode' => $this->code,
            'code' => $this->code,
            'startsAt' => $this->starts_at?->toIso8601String(),
            'endsAt' => $this->ends_at?->toIso8601String(),
            'startDate' => $this->starts_at?->toDateString(),
            'endDate' => $this->ends_at?->toDateString(),
            'start_date' => $this->starts_at?->toDateString(),
            'end_date' => $this->ends_at?->toDateString(),
            'priority' => (int) ($this->priority ?? 0),
            'sortOrder' => (int) ($this->sort_order ?? 0),
            'sort_order' => (int) ($this->sort_order ?? 0),
            'isActive' => (bool) $this->is_active,
            'is_active' => (bool) $this->is_active,
            'status' => $status,
            'scheduleStatus' => $status,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
