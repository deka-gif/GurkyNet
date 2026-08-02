<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone_number,
            'walletBalance' => $this->wallet ? (float) $this->wallet->balance : 0.00,
            'transactionsCount' => $this->transactions_count ?? 0,
            'supportTicketsCount' => $this->support_tickets_count ?? 0,
            'recentTransactions' => TransactionResource::collection($this->transactions()->latest()->take(5)->get()),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
