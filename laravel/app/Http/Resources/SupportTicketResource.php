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
            'subject' => $this->subject,
            'description' => $this->description,
            'priority' => $this->priority,
            'status' => \App\Support\Support\TicketStatus::normalize((string) $this->status),
            'statusLabel' => \App\Support\Support\TicketStatus::label((string) $this->status),
            'statusRaw' => $this->status,
            'assignedTo' => $this->assigned_to,
            'assignee' => $this->whenLoaded('assignee', fn () => [
                'id' => $this->assignee?->id,
                'name' => $this->assignee?->name,
            ]),
            'source' => $this->source,
            'replies' => TicketReplyResource::collection($this->whenLoaded('replies')),
            'createdAt' => $this->created_at?->toIso8601String(),
            'resolvedAt' => $this->resolved_at?->toIso8601String(),
            'closedAt' => $this->closed_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
            // FR-CS-03 / SRS Bagian 23
            'sla' => app(\App\Services\Sla\SlaEvaluationService::class)->forSupportTicket($this->resource),
        ];
    }
}
