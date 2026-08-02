<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketReplyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supportTicketId' => $this->support_ticket_id,
            'user' => [
                'id' => $this->user?->id,
                'name' => $this->user?->name,
                'email' => $this->user?->email,
                'role' => $this->user?->role instanceof \App\Enums\UserRole ? $this->user->role->value : $this->user?->role,
            ],
            'message' => $this->message,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
