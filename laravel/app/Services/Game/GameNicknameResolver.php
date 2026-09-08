<?php

namespace App\Services\Game;

/**
 * Facade for game account schema + VIP nickname helpers.
 *
 * Digi purchase schema SoT: GameAccountSchemaResolver
 *   SKU override > Game Profile > Digi evidence > UNKNOWN
 *
 * VIP nickname_codes remain optional get-nickname helpers only.
 */
class GameNicknameResolver
{
    public const CATALOG_DIGI = GameAccountSchemaResolver::CATALOG_DIGI;

    public const CATALOG_VIP = GameAccountSchemaResolver::CATALOG_VIP;

    public function __construct(
        protected GameAccountSchemaResolver $schemas,
    ) {}

    /**
     * @return array{
     *   code:string,
     *   label:string,
     *   delivery:string,
     *   fields:list<array{key:string,label:string,required:bool}>,
     *   source:string,
     *   schema_key:?string,
     *   provenance:?array{source:string,evidence:string,confidence:string},
     *   purchasable:bool,
     *   not_purchasable_reason:?string,
     *   lifecycle:string
     * }
     */
    public function resolveForProduct(string $brand, ?string $skuCode = null): array
    {
        $resolved = $this->schemas->resolve($brand, $skuCode);

        // Prefer VIP nickname code when brand maps — lookup helper only.
        $nickCode = $this->schemas->nicknameCodeForBrand($brand);
        if ($nickCode !== null && ($resolved['delivery'] ?? '') === 'account') {
            $resolved['code'] = $nickCode;
        }

        return $resolved;
    }

    /**
     * Brand-only resolve (legacy). Prefer resolveForProduct when SKU is known.
     *
     * @return array{
     *   code:string,
     *   label:string,
     *   delivery:string,
     *   fields:list<array{key:string,label:string,required:bool}>,
     *   source:string,
     *   schema_key:?string,
     *   provenance:?array{source:string,evidence:string,confidence:string},
     *   purchasable:bool,
     *   not_purchasable_reason:?string,
     *   lifecycle:string
     * }
     */
    public function resolve(string $brand): array
    {
        return $this->resolveForProduct($brand, null);
    }

    public function isNonPurchaseSku(?string $skuCode): bool
    {
        return $this->schemas->isNonPurchaseSku($skuCode);
    }

    /**
     * @return 'digiflazz'|'vip'|null
     */
    public function detectCatalogSource(?string $skuCode): ?string
    {
        return $this->schemas->detectCatalogSource($skuCode);
    }

    public function isPurchasableSchema(array $resolved): bool
    {
        return $this->schemas->isPurchasableSchema($resolved);
    }
}
