<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VoucherPhysicalBatchItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'serialNumber' => $this->serial_number,
            'status' => $this->status,
            'scannedAt' => $this->scanned_at?->toIso8601String(),
            'submittedAt' => $this->submitted_at?->toIso8601String(),
            'activatedAt' => $this->activated_at?->toIso8601String(),
            'failureReason' => $this->failure_reason,
            'refundAmount' => $this->refund_amount !== null ? (float) $this->refund_amount : null,
            'refundedAt' => $this->refunded_at?->toIso8601String(),
            'retryCount' => $this->retry_count,
        ];
    }
}
