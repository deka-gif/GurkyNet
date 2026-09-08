<?php

namespace App\Services\Catalog;

/**
 * Classification layer: category slug → transaction capability.
 * Does not change Digi/VIP fulfillment engines.
 */
class ProductTransactionCapabilityRegistry
{
    /**
     * @return array{
     *   mode:string,
     *   target_schema:string,
     *   inquiry_required:bool,
     *   payment_required:bool,
     *   provider_operation:?string,
     *   status_behavior:?string,
     *   refund_behavior:?string,
     *   mobile_purchase:bool,
     *   web_purchase:bool,
     *   requires_resolved_account_schema:bool,
     *   known:bool
     * }|null
     */
    public function forCategorySlug(?string $slug): ?array
    {
        $slug = strtolower(trim((string) $slug));
        if ($slug === '') {
            return null;
        }

        // Aliases
        $slug = match ($slug) {
            'paket-data' => 'data',
            'ewallet', 'e-money' => 'topup-digital',
            'games', 'topup-game', 'top-up-game', 'game-feature' => 'game',
            'langganan', 'streaming' => 'langganan-digital',
            'token-pln' => 'pln',
            default => $slug,
        };

        $categories = config('gurky_transaction_capabilities.categories', []);
        if (! is_array($categories) || ! isset($categories[$slug]) || ! is_array($categories[$slug])) {
            return null;
        }

        $cat = $categories[$slug];
        $modeKey = (string) ($cat['mode'] ?? '');
        $modes = config('gurky_transaction_capabilities.modes', []);
        $mode = is_array($modes[$modeKey] ?? null) ? $modes[$modeKey] : [];

        $requiresSchema = (bool) ($cat['requires_resolved_account_schema']
            ?? $mode['requires_resolved_account_schema']
            ?? false);

        return [
            'mode' => $modeKey !== '' ? $modeKey : 'UNKNOWN',
            'target_schema' => (string) ($cat['target_schema'] ?? 'CUSTOMER_NO'),
            'inquiry_required' => (bool) ($mode['inquiry_required'] ?? false),
            'payment_required' => (bool) ($mode['payment_required'] ?? true),
            'provider_operation' => isset($mode['provider_operation'])
                ? (is_string($mode['provider_operation']) ? $mode['provider_operation'] : null)
                : null,
            'status_behavior' => isset($mode['status_behavior']) && is_string($mode['status_behavior'])
                ? $mode['status_behavior']
                : null,
            'refund_behavior' => isset($mode['refund_behavior']) && is_string($mode['refund_behavior'])
                ? $mode['refund_behavior']
                : null,
            'mobile_purchase' => (bool) ($cat['mobile_purchase'] ?? false),
            'web_purchase' => (bool) ($cat['web_purchase'] ?? false),
            'requires_resolved_account_schema' => $requiresSchema,
            'known' => true,
        ];
    }
}
