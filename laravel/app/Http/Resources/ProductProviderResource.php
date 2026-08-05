<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductProviderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Product Management dropdown contract: id, name, code (+ optional meta).
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'isActive' => (bool) ($this->is_active ?? true),
            'sortOrder' => (int) ($this->sort_order ?? 0),
            'priority' => (int) ($this->priority ?? 100),
            'apiStatus' => $this->api_status ?? 'unknown',
            'healthColor' => $this->health_color ?? 'yellow',
        ];
    }
}
