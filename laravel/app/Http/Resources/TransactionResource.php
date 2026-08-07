<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $normalizedStatus = $this->status;
        if (in_array($this->status, ['success', 'sukses'])) {
            $normalizedStatus = 'success';
        } elseif (in_array($this->status, ['failed', 'gagal', 'expired'])) {
            $normalizedStatus = 'failed';
        } elseif (in_array($this->status, ['canceled', 'cancelled', 'batal'])) {
            $normalizedStatus = 'cancelled';
        } else {
            $normalizedStatus = 'pending';
        }

        return [
            'id' => $this->id,
            'transactionCode' => $this->invoice_number,
            'serviceName' => $this->service_name,
            'productName' => $this->service_name,
            'targetNo' => $this->target_number,
            'amount' => (float) $this->amount,
            'adminFee' => (float) $this->admin_fee,
            'totalPayment' => (float) $this->total_payment,
            'paymentMethod' => $this->payment_method,
            'status' => $normalizedStatus,
            'notes' => $this->notes,
            // Existing fulfillment column — expose for history badges (no provider logic change).
            'providerCode' => $this->fulfillment_provider_code,
            'providerName' => $this->fulfillment_provider_code,
            'items' => TransactionItemResource::collection($this->whenLoaded('items')),
            'date' => $this->created_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
