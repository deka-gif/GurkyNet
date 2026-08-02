<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'productCode' => $this->product_code,
            'productName' => $this->product_name,
            'price' => (float) $this->price,
            'quantity' => (int) $this->quantity,
            'customMetadata' => $this->custom_metadata,
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
