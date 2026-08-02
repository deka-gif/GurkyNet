<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PromotionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type ?? 'promotion',
            'title' => $this->title,
            'code' => $this->code,
            'description' => $this->description,
            'discountAmount' => (float) ($this->discount_amount ?? 0),
            'discountType' => $this->discount_type ?? 'fixed',
            'minTransaction' => (float) ($this->min_transaction ?? 0),
            'quota' => (int) ($this->quota ?? 0),
            'usedCount' => (int) ($this->used_count ?? 0),
            'image' => $this->imageMedia ? new MediaResource($this->imageMedia) : $this->image_url,
            'mobileImage' => $this->mobileImageMedia ? new MediaResource($this->mobileImageMedia) : null,
            'imageMediaId' => $this->image_media_id,
            'mobileImageMediaId' => $this->mobile_image_media_id,
            'redirectUrl' => $this->redirect_url,
            'isActive' => (bool) $this->is_active,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
