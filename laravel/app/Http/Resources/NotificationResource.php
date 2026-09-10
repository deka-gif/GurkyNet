<?php

namespace App\Http\Resources;

use App\Services\NotificationService;
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

        $category = app(NotificationService::class)->resolveCategory($rawType, $payload);

        // Canonical customer categories + legacy aliases for existing clients.
        $mappedType = match ($category) {
            NotificationService::CATEGORY_TRANSACTION => 'transaction',
            NotificationService::CATEGORY_PROMOTION => 'promotion',
            default => 'announcement',
        };

        $transactionId = $payload['transaction_id'] ?? null;
        $invoiceNumber = $payload['invoice_number'] ?? null;
        $announcementId = $payload['announcement_id'] ?? null;
        $campaignId = $payload['campaign_id'] ?? null;
        $deepLink = $payload['deep_link'] ?? null;
        $imageUrl = $payload['image_url'] ?? $payload['image'] ?? null;

        return [
            'id' => $this->id,
            'title' => $title,
            'message' => $message,
            'type' => $mappedType,
            'category' => $category,
            'rawType' => $rawType,
            'isRead' => (bool) ($this->is_read ?? false),
            'createdAt' => $this->created_at?->toIso8601String() ?? $notification?->created_at?->toIso8601String(),
            'transactionId' => $transactionId !== null ? (string) $transactionId : null,
            'invoiceNumber' => $invoiceNumber !== null ? (string) $invoiceNumber : null,
            'announcementId' => $announcementId !== null ? (string) $announcementId : null,
            'campaignId' => $campaignId !== null ? (string) $campaignId : null,
            'deepLink' => $deepLink !== null ? (string) $deepLink : null,
            'imageUrl' => $imageUrl !== null ? (string) $imageUrl : null,
        ];
    }
}
