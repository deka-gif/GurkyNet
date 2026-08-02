<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupportTicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticketNumber' => $this->ticket_number,
            'user' => [
                'id' => $this->user?->id,
                'name' => $this->user?->name,
                'email' => $this->user?->email,
                'phone' => $this->user?->phone_number,
            ],
            'transactionId' => $this->transaction_id,
            'transaction' => new TransactionResource($this->whenLoaded('transaction')),
            'category' => $this->category,
            'priority' => $this->priority,
            'status' => $this->status,
            'replies' => TicketReplyResource::collection($this->whenLoaded('replies')),
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
