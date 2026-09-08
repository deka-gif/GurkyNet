<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Services\AvailabilityService;
use App\Services\Game\GameAccountSchemaResolver;
use App\Services\Langganan\LanggananAccountResolver;

/**
 * Product purchase lifecycle evaluator.
 *
 * SYNCED → CLASSIFIED → SCHEMA_RESOLVED → CAPABILITY_RESOLVED → CUSTOMER_VISIBLE → PURCHASABLE
 *
 * Layers on top of AvailabilityService — does not replace wallet/idempotency safety.
 * Game + Langganan: reuse existing schema resolvers (no duplicate schema system).
 */
class ProductPurchaseLifecycleService
{
    public const STAGE_SYNCED = 'SYNCED';

    public const STAGE_CLASSIFIED = 'CLASSIFIED';

    public const STAGE_SCHEMA_RESOLVED = 'SCHEMA_RESOLVED';

    public const STAGE_CAPABILITY_RESOLVED = 'CAPABILITY_RESOLVED';

    public const STAGE_CUSTOMER_VISIBLE = 'CUSTOMER_VISIBLE';

    public const STAGE_PURCHASABLE = 'PURCHASABLE';

    public const STAGE_NEEDS_REVIEW = 'NEEDS_REVIEW';

    public const STAGE_NOT_PURCHASABLE = 'NOT_PURCHASABLE';

    public const REASON_UNKNOWN_SCHEMA = 'UNKNOWN_SCHEMA';

    public function __construct(
        protected AvailabilityService $availability,
        protected ProductTransactionCapabilityRegistry $capabilities,
        protected GameAccountSchemaResolver $gameSchemas,
        protected LanggananAccountResolver $langgananSchemas,
    ) {}

    /**
     * @return array{
     *   stage:string,
     *   purchasable:bool,
     *   catalog_visible:bool,
     *   reason:?string,
     *   capability:?array,
     *   account_schema:?array
     * }
     */
    public function evaluate(Product $product): array
    {
        $product->loadMissing(['category', 'provider', 'productProvider']);

        $slug = strtolower(trim((string) ($product->category?->slug ?? '')));
        $capability = $this->capabilities->forCategorySlug($slug !== '' ? $slug : null);

        $availability = $this->availability->getStatus($product);
        $availPurchasable = $availability === 'active';
        $availVisible = $availability === 'active' || $availability === 'maintenance';

        if ($capability === null) {
            return [
                'stage' => self::STAGE_NEEDS_REVIEW,
                'purchasable' => false,
                'catalog_visible' => $availVisible,
                'reason' => 'MISSING_CAPABILITY',
                'capability' => null,
                'account_schema' => null,
            ];
        }

        if (! $availPurchasable) {
            return [
                'stage' => self::STAGE_NOT_PURCHASABLE,
                'purchasable' => false,
                'catalog_visible' => $availVisible,
                'reason' => 'PROVIDER_INACTIVE',
                'capability' => $capability,
                'account_schema' => null,
            ];
        }

        $accountSchema = null;
        if (! empty($capability['requires_resolved_account_schema'])) {
            if ($slug === 'game') {
                $brand = trim((string) ($product->provider?->name ?? ''));
                $accountSchema = $this->gameSchemas->resolve($brand, $product->sku_code);

                if ($this->gameSchemas->isNonPurchaseSku($product->sku_code)) {
                    return [
                        'stage' => self::STAGE_NOT_PURCHASABLE,
                        'purchasable' => false,
                        'catalog_visible' => false,
                        'reason' => GameAccountSchemaResolver::REASON_NON_PURCHASE,
                        'capability' => $capability,
                        'account_schema' => $accountSchema,
                    ];
                }

                if (! $this->gameSchemas->isPurchasableSchema($accountSchema)) {
                    $reason = $accountSchema['not_purchasable_reason']
                        ?? GameAccountSchemaResolver::REASON_UNKNOWN_SCHEMA;

                    return [
                        'stage' => ($accountSchema['lifecycle'] ?? self::STAGE_NEEDS_REVIEW),
                        'purchasable' => false,
                        'catalog_visible' => false,
                        'reason' => $reason,
                        'capability' => $capability,
                        'account_schema' => $accountSchema,
                    ];
                }
            }

            if (in_array($slug, ['langganan-digital', 'langganan', 'streaming'], true)) {
                $brand = trim((string) ($product->provider?->name ?? ''));
                $resolved = $this->langgananSchemas->resolveForProduct($brand, $product->sku_code);
                $accountSchema = $resolved;

                if (! $this->isLanggananPurchasableSchema($resolved)) {
                    return [
                        'stage' => self::STAGE_NEEDS_REVIEW,
                        'purchasable' => false,
                        'catalog_visible' => false,
                        'reason' => self::REASON_UNKNOWN_SCHEMA,
                        'capability' => $capability,
                        'account_schema' => $accountSchema,
                    ];
                }
            }
        }

        if (! $capability['mobile_purchase'] && ! $capability['web_purchase']) {
            return [
                'stage' => self::STAGE_NOT_PURCHASABLE,
                'purchasable' => false,
                'catalog_visible' => $availVisible,
                'reason' => 'UNSUPPORTED_TRANSACTION',
                'capability' => $capability,
                'account_schema' => $accountSchema,
            ];
        }

        return [
            'stage' => self::STAGE_PURCHASABLE,
            'purchasable' => true,
            'catalog_visible' => true,
            'reason' => null,
            'capability' => $capability,
            'account_schema' => $accountSchema,
        ];
    }

    /**
     * Langganan: voucher (no account fields) or account (with fields) is purchasable.
     *
     * @param  array{delivery?:string,fields?:list<mixed>}  $resolved
     */
    public function isLanggananPurchasableSchema(array $resolved): bool
    {
        $delivery = strtolower(trim((string) ($resolved['delivery'] ?? '')));
        if ($delivery === 'voucher') {
            return true;
        }
        if ($delivery === 'account' && ($resolved['fields'] ?? []) !== []) {
            return true;
        }

        return false;
    }
}
