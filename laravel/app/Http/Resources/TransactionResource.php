<?php

namespace App\Http\Resources;

use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $rawStatus = $this->status;
        $normalizedStatus = $rawStatus;
        if (in_array($rawStatus, ['success', 'sukses'], true)) {
            $normalizedStatus = 'success';
        } elseif (in_array($rawStatus, ['failed', 'gagal', 'expired'], true)) {
            $normalizedStatus = 'failed';
        } elseif (in_array($rawStatus, ['canceled', 'cancelled', 'batal'], true)) {
            $normalizedStatus = 'cancelled';
        } elseif (in_array($rawStatus, ['REFUNDED', 'refunded'], true)) {
            $normalizedStatus = 'refunded';
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
            // Keep legacy UI-normalized status; expose SRS vocabulary separately (14.3).
            'status' => $normalizedStatus,
            'status_srs' => TransactionStatusMapper::toSrs($rawStatus),
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
