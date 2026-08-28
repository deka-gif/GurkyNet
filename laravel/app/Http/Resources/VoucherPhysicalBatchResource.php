<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VoucherPhysicalBatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'transactionId' => $this->transaction_id,
            'invoiceNumber' => $this->transaction?->invoice_number,
            'status' => $this->status,
            'transactionStatus' => $this->transaction?->status,
            'skuCode' => $this->sku_code,
            'operatorName' => $this->operator_name,
            'quotaLabel' => $this->quota_label,
            'unitPrice' => (float) $this->unit_price,
            'totalSerials' => $this->total_serials,
            'successCount' => $this->success_count,
            'failedCount' => $this->failed_count,
            'refundedCount' => $this->refunded_count,
            'totalPayment' => (float) ($this->transaction?->total_payment ?? 0),
            'items' => VoucherPhysicalBatchItemResource::collection($this->whenLoaded('items')),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
