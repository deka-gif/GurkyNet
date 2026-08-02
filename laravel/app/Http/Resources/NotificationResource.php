<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // $this is a UserNotification model, or a Notification model
        // If it is a UserNotification, we access its relation.
        $notification = $this->relationLoaded('notification') ? $this->notification : $this->notification;
        
        $title = $notification ? $notification->title : ($this->title ?? '');
        $message = $notification ? $notification->message : ($this->message ?? '');
        $type = $notification ? $notification->type : ($this->type ?? 'info');

        // Let's map db notification types (broadcast, transaction, system) to frontend types (info, promo, transaksi)
        $mappedType = 'info';
        if ($type === 'promo' || $type === 'broadcast') {
            $mappedType = 'promo';
        } elseif ($type === 'transaction' || $type === 'transaksi') {
            $mappedType = 'transaksi';
        }

        return [
            'id' => $this->id,
            'title' => $title,
            'message' => $message,
            'type' => $mappedType,
            'isRead' => (bool) ($this->is_read ?? false),
            'createdAt' => $this->created_at?->toIso8601String() ?? $notification?->created_at?->toIso8601String(),
        ];
    }
}
