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
            'subtitle' => $this->subtitle,
            'slug' => $this->slug,
            'componentType' => $this->component_type,
            'displayOrder' => (int) $this->display_order,
            'visible' => (bool) $this->visible,
            'status' => $this->status,
            'description' => $this->description,
            'backgroundColor' => $this->background_color,
            'textColor' => $this->text_color,
            'buttonLabel' => $this->button_label,
            'buttonUrl' => $this->button_url,
            'animation' => $this->animation ?: 'fade',
            'contentItems' => is_array($this->content_items) ? $this->content_items : [],
            'config' => is_array($this->config) ? $this->config : [],
            'heroBackgroundMedia' => $this->heroBackgroundMedia ? new MediaResource($this->heroBackgroundMedia) : null,
            'heroIllustrationMedia' => $this->heroIllustrationMedia ? new MediaResource($this->heroIllustrationMedia) : null,
            'heroMobileImageMedia' => $this->heroMobileImageMedia ? new MediaResource($this->heroMobileImageMedia) : null,
            'heroBackgroundMediaId' => $this->hero_background_media_id,
            'heroIllustrationMediaId' => $this->hero_illustration_media_id,
            'heroMobileImageMediaId' => $this->hero_mobile_image_media_id,
            'createdBy' => $this->created_by,
            'updatedBy' => $this->updated_by,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
