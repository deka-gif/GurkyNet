<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionItemResource extends JsonResource
{
    /** Cost / margin keys must never reach customer apps; Ops/Finance/CS keep full meta. */
    protected const CUSTOMER_HIDDEN_META_KEYS = [
        'base_price',
        'margin',
        'provider_cost',
        'basePrice',
        'providerCost',
        'hpp',
        'buying_price',
        'provider_price',
        'modal',
    ];

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'productCode' => $this->product_code,
            'productName' => $this->product_name,
            'price' => (float) $this->price,
            'quantity' => (int) $this->quantity,
            'customMetadata' => $this->customerSafeMetadata($request, $this->custom_metadata),
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $meta
     * @return array<string, mixed>|null
     */
    protected function customerSafeMetadata(Request $request, mixed $meta): ?array
    {
        if (! is_array($meta)) {
            return null;
        }

        if ($this->viewerMaySeeCostMetadata($request)) {
            return $meta;
        }

        return array_diff_key($meta, array_flip(self::CUSTOMER_HIDDEN_META_KEYS));
    }

    protected function viewerMaySeeCostMetadata(Request $request): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }

        $rawRole = $user->role ?? null;
        $role = $rawRole instanceof UserRole ? $rawRole->value : (string) $rawRole;
        $internal = [
            UserRole::SUPER_ADMIN->value,
            UserRole::OWNER->value,
            UserRole::FINANCE->value,
            UserRole::OPERATIONS->value,
            UserRole::CUSTOMER_SUPPORT->value,
        ];

        return in_array($role, $internal, true);
    }
}
