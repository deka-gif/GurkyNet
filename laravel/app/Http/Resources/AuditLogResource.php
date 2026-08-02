<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'activity' => $this->activity,
            'payload' => $this->payload,
            'user' => [
                'id' => $this->user?->id,
                'name' => $this->user?->name,
                'email' => $this->user?->email,
                'role' => $this->user?->role instanceof \App\Enums\UserRole ? $this->user->role->value : $this->user?->role,
            ],
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
