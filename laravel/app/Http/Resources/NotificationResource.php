<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // $this is a UserNotification model with notification relation.
        $notification = $this->relationLoaded('notification')
            ? $this->notification
            : $this->notification;

        $title = $notification ? $notification->title : ($this->title ?? '');
        $message = $notification ? $notification->message : ($this->message ?? '');
        $rawType = $notification ? (string) $notification->type : (string) ($this->type ?? 'info');
        $payload = is_array($notification?->payload ?? null) ? $notification->payload : [];

        // Map db notification types to frontend inbox categories while keeping rawType for toasts.
        $mappedType = 'info';
        if ($rawType === 'promo' || $rawType === 'broadcast') {
            $mappedType = 'promo';
        } elseif (
            str_contains($rawType, 'transaction')
            || $rawType === 'transaksi'
            || $rawType === 'success'
        ) {
            $mappedType = 'transaksi';
        }

        $transactionId = $payload['transaction_id'] ?? null;
        $invoiceNumber = $payload['invoice_number'] ?? null;

        return [
            'id' => $this->id,
            'title' => $title,
            'message' => $message,
            'type' => $mappedType,
            'rawType' => $rawType,
            'isRead' => (bool) ($this->is_read ?? false),
            'createdAt' => $this->created_at?->toIso8601String() ?? $notification?->created_at?->toIso8601String(),
            'transactionId' => $transactionId !== null ? (string) $transactionId : null,
            'invoiceNumber' => $invoiceNumber !== null ? (string) $invoiceNumber : null,
        ];
    }
}
