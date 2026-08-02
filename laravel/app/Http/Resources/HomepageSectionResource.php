<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HomepageSectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'componentType' => $this->component_type,
            'displayOrder' => (int) $this->display_order,
            'visible' => (bool) $this->visible,
            'status' => $this->status,
            'description' => $this->description,
            'heroBackgroundMedia' => $this->heroBackgroundMedia ? new MediaResource($this->heroBackgroundMedia) : null,
            'heroIllustrationMedia' => $this->heroIllustrationMedia ? new MediaResource($this->heroIllustrationMedia) : null,
            'heroMobileImageMedia' => $this->heroMobileImageMedia ? new MediaResource($this->heroMobileImageMedia) : null,
            'heroBackgroundMediaId' => $this->hero_background_media_id,
            'heroIllustrationMediaId' => $this->hero_illustration_media_id,
            'heroMobileImageMediaId' => $this->hero_mobile_image_media_id,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
