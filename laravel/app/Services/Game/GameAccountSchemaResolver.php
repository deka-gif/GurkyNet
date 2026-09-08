<?php

namespace App\Services\Game;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductProvider;
use Illuminate\Support\Str;

/**
 * Digi Game account schema SoT.
 *
 * Priority: SKU override > Game Profile > Digi provider evidence > UNKNOWN.
 * Never inherits VIP nickname_codes as Digi purchase schema.
 *
 * @phpstan-type SchemaField array{key:string,label:string,required:bool}
 * @phpstan-type ResolvedSchema array{
 *   code:string,
 *   label:string,
 *   delivery:string,
 *   fields:list<SchemaField>,
 *   source:string,
 *   schema_key:?string,
 *   provenance:?array{source:string,evidence:string,confidence:string},
 *   purchasable:bool,
 *   not_purchasable_reason:?string,
 *   lifecycle:string
 * }
 */
class GameAccountSchemaResolver
{
    public const CATALOG_DIGI = 'digiflazz';

    public const CATALOG_VIP = 'vip';

    public const LIFECYCLE_PURCHASABLE = 'PURCHASABLE';

    public const LIFECYCLE_NEEDS_REVIEW = 'NEEDS_REVIEW';

    public const LIFECYCLE_NOT_PURCHASABLE = 'NOT_PURCHASABLE';

    public const REASON_UNKNOWN_SCHEMA = 'UNKNOWN_SCHEMA';

    public const REASON_NON_PURCHASE = 'NON_PURCHASE';

    public const REASON_VIP_SCHEMA_OFF = 'VIP_SCHEMA_OFF';

    /**
     * @return ResolvedSchema
     */
    public function resolve(string $brand, ?string $skuCode = null): array
    {
        $sku = trim((string) $skuCode);
        $brandTrim = trim($brand);
        $catalog = $this->detectCatalogSource($sku);

        if ($sku !== '' && $this->isNonPurchaseSku($sku)) {
            return $this->notPurchasable(
                $brandTrim,
                self::REASON_NON_PURCHASE,
                self::LIFECYCLE_NOT_PURCHASABLE,
                'non_purchase'
            );
        }

        // VIP catalog: purchase schema OFF (DigiFlazz sole SoT).
        if ($catalog === self::CATALOG_VIP) {
            return $this->notPurchasable(
                $brandTrim,
                self::REASON_VIP_SCHEMA_OFF,
                self::LIFECYCLE_NOT_PURCHASABLE,
                'unknown'
            );
        }

        if ($sku !== '') {
            $override = $this->matchSkuOverride($sku);
            if ($override !== null) {
                return $override;
            }
        }

        // Digi Game Profile (brand default) — applies to Digi / brand-only, never VIP.
        if ($catalog !== self::CATALOG_VIP) {
            $profile = $this->matchGameProfile($brandTrim);
            if ($profile !== null) {
                return $profile;
            }
        }

        if ($sku !== '' && $this->mayUseDigiflazzMetadata($catalog, $sku)) {
            $fromDesc = app(GameDigiflazzHintReader::class)->read($sku);
            if ($fromDesc !== null) {
                $brandResolved = $this->resolveBrandIdentity($brandTrim);

                return $this->purchasableAccount(
                    $brandResolved['code'],
                    $brandResolved['label'] !== 'Game' || $brandTrim === ''
                        ? $brandResolved['label']
                        : ($brandTrim !== '' ? $brandTrim : 'Game'),
                    $this->normalizeFields($fromDesc['fields'] ?? []),
                    'digiflazz_desc',
                    $this->inferSchemaKeyFromFields($fromDesc['fields'] ?? []),
                    [
                        'source' => 'DIGIFLAZZ_DESCRIPTION',
                        'evidence' => 'Parsed digiflazz_products.desc',
                        'confidence' => 'verified',
                    ]
                );
            }
        }

        return $this->notPurchasable(
            $brandTrim,
            self::REASON_UNKNOWN_SCHEMA,
            self::LIFECYCLE_NEEDS_REVIEW,
            'unknown'
        );
    }

    public function isPurchasableSchema(array $resolved): bool
    {
        return ($resolved['purchasable'] ?? false) === true
            && strtolower((string) ($resolved['delivery'] ?? '')) === 'account'
            && ($resolved['fields'] ?? []) !== [];
    }

    public function isNonPurchaseSku(?string $skuCode): bool
    {
        $sku = trim((string) $skuCode);
        if ($sku === '') {
            return false;
        }

        $list = config('gurky_game.non_purchase_skus', []);
        if (! is_array($list)) {
            return false;
        }

        foreach ($list as $code) {
            if (strcasecmp((string) $code, $sku) === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return 'digiflazz'|'vip'|null
     */
    public function detectCatalogSource(?string $skuCode): ?string
    {
        $sku = trim((string) $skuCode);
        if ($sku === '') {
            return null;
        }

        if (str_starts_with(strtoupper($sku), 'VIP-')) {
            return self::CATALOG_VIP;
        }

        $product = Product::query()
            ->with('productProvider')
            ->where('sku_code', $sku)
            ->first();

        $code = strtolower(trim((string) ($product?->productProvider?->code ?? '')));
        if ($code === ProductProvider::CODE_DIGIFLAZZ) {
            return self::CATALOG_DIGI;
        }
        if ($code === ProductProvider::CODE_VIP) {
            return self::CATALOG_VIP;
        }

        return null;
    }

    /**
     * VIP get-nickname brand code (optional UX) — separate from Digi purchase schema.
     */
    public function nicknameCodeForBrand(string $brand): ?string
    {
        $hit = $this->matchNicknameBrand($brand);

        return $hit['code'] ?? null;
    }

    protected function mayUseDigiflazzMetadata(?string $catalog, string $sku): bool
    {
        if ($catalog === self::CATALOG_VIP) {
            return false;
        }
        if ($catalog === self::CATALOG_DIGI) {
            return true;
        }

        return $this->hasDigiflazzRow($sku);
    }

    protected function hasDigiflazzRow(string $sku): bool
    {
        return DigiflazzProduct::query()
            ->where('buyer_sku_code', $sku)
            ->exists();
    }

    /**
     * @return ResolvedSchema|null
     */
    protected function matchSkuOverride(string $sku): ?array
    {
        $maps = [
            config('gurky_game.sku_overrides', []),
            // Legacy key used by older tests/config — treat as overrides.
            config('gurky_game.sku_schemas', []),
        ];

        foreach ($maps as $schemas) {
            if (! is_array($schemas) || $schemas === []) {
                continue;
            }
            foreach ($schemas as $code => $meta) {
                if (! is_array($meta)) {
                    continue;
                }
                if (strcasecmp((string) $code, $sku) !== 0) {
                    continue;
                }

                return $this->formatOverride($meta, (string) $code);
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return ResolvedSchema
     */
    protected function formatOverride(array $meta, string $skuCode): array
    {
        $provenance = $this->normalizeProvenance($meta['provenance'] ?? null);
        $delivery = strtolower(trim((string) ($meta['delivery'] ?? 'account')));
        $schemaKey = isset($meta['schema_key']) ? (string) $meta['schema_key'] : null;

        if ($schemaKey !== null && $schemaKey !== '') {
            $def = $this->schemaDefinition($schemaKey);
            if ($def === null) {
                return $this->notPurchasable(
                    $skuCode,
                    self::REASON_UNKNOWN_SCHEMA,
                    self::LIFECYCLE_NEEDS_REVIEW,
                    'sku_override'
                );
            }
            $identity = $this->resolveBrandIdentity((string) ($meta['label'] ?? $def['schema_key']));

            return $this->purchasableAccount(
                (string) ($meta['code'] ?? $identity['code']),
                (string) ($meta['label'] ?? $identity['label']),
                $this->normalizeFields($def['fields'] ?? []),
                'sku_override',
                $schemaKey,
                $provenance ?? [
                    'source' => 'SKU_OVERRIDE',
                    'evidence' => 'sku='.$skuCode,
                    'confidence' => 'verified',
                ]
            );
        }

        if ($delivery !== 'account') {
            return [
                'code' => Str::slug($skuCode) ?: 'game',
                'label' => (string) ($meta['label'] ?? $skuCode),
                'delivery' => 'unknown',
                'fields' => [],
                'source' => 'sku_override',
                'schema_key' => null,
                'provenance' => $provenance,
                'purchasable' => false,
                'not_purchasable_reason' => self::REASON_UNKNOWN_SCHEMA,
                'lifecycle' => self::LIFECYCLE_NEEDS_REVIEW,
            ];
        }

        $fields = $this->normalizeFields($meta['fields'] ?? []);
        if ($fields === []) {
            return $this->notPurchasable(
                $skuCode,
                self::REASON_UNKNOWN_SCHEMA,
                self::LIFECYCLE_NEEDS_REVIEW,
                'sku_override'
            );
        }

        if ($provenance === null) {
            // Owner rule: override must have provenance/evidence.
            return $this->notPurchasable(
                $skuCode,
                self::REASON_UNKNOWN_SCHEMA,
                self::LIFECYCLE_NEEDS_REVIEW,
                'sku_override'
            );
        }

        $identity = $this->resolveBrandIdentity((string) ($meta['label'] ?? $skuCode));

        return $this->purchasableAccount(
            (string) ($meta['code'] ?? $identity['code']),
            (string) ($meta['label'] ?? $identity['label']),
            $fields,
            'sku_override',
            $this->inferSchemaKeyFromFields($fields),
            $provenance
        );
    }

    /**
     * @return ResolvedSchema|null
     */
    protected function matchGameProfile(string $brand): ?array
    {
        $brandNorm = $this->normalize($brand);
        if ($brandNorm === '') {
            return null;
        }

        $profiles = config('gurky_game.game_profiles', []);
        if (! is_array($profiles)) {
            return null;
        }

        foreach ($profiles as $code => $meta) {
            if (! is_array($meta)) {
                continue;
            }
            if (! $this->brandMatches($brandNorm, (string) $code, $meta)) {
                continue;
            }

            $schemaKey = (string) ($meta['schema_key'] ?? '');
            $def = $this->schemaDefinition($schemaKey);
            if ($def === null) {
                return null;
            }

            $provenance = $this->normalizeProvenance($meta['provenance'] ?? null);
            if ($provenance === null) {
                // Profiles must carry provenance.
                return null;
            }

            return $this->purchasableAccount(
                (string) $code,
                (string) ($meta['label'] ?? $brand),
                $this->normalizeFields($def['fields'] ?? []),
                'game_profile',
                $schemaKey,
                $provenance
            );
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function schemaDefinition(string $schemaKey): ?array
    {
        $key = trim($schemaKey);
        if ($key === '') {
            return null;
        }
        $all = config('gurky_game.schemas', []);
        if (! is_array($all) || ! isset($all[$key]) || ! is_array($all[$key])) {
            return null;
        }

        return $all[$key];
    }

    /**
     * @param  list<SchemaField>|array<int, mixed>  $fields
     */
    protected function inferSchemaKeyFromFields(array $fields): ?string
    {
        $keys = [];
        foreach ($fields as $field) {
            if (! is_array($field)) {
                continue;
            }
            $k = strtolower(trim((string) ($field['key'] ?? '')));
            if ($k !== '') {
                $keys[] = $k;
            }
        }
        sort($keys);
        $sig = implode('+', $keys);

        return match ($sig) {
            'player_id' => 'PLAYER_ID',
            'user_id' => 'USER_ID',
            'garena_id' => 'GARENA_ID',
            'account_id' => 'ACCOUNT_ID',
            'phone' => 'PHONE',
            'customer_no' => 'CUSTOMER_NO',
            'user_id+zone_id' => 'USER_ID_ZONE_ID',
            'server_id+user_id' => 'USER_ID_SERVER_ID',
            default => null,
        };
    }

    /**
     * @param  list<SchemaField>  $fields
     * @param  array{source:string,evidence:string,confidence:string}  $provenance
     * @return ResolvedSchema
     */
    protected function purchasableAccount(
        string $code,
        string $label,
        array $fields,
        string $source,
        ?string $schemaKey,
        array $provenance
    ): array {
        return [
            'code' => $code !== '' ? $code : 'game',
            'label' => $label !== '' ? $label : 'Game',
            'delivery' => 'account',
            'fields' => $fields,
            'source' => $source,
            'schema_key' => $schemaKey,
            'provenance' => $provenance,
            'purchasable' => $fields !== [],
            'not_purchasable_reason' => $fields === [] ? self::REASON_UNKNOWN_SCHEMA : null,
            'lifecycle' => $fields !== [] ? self::LIFECYCLE_PURCHASABLE : self::LIFECYCLE_NEEDS_REVIEW,
        ];
    }

    /**
     * @return ResolvedSchema
     */
    protected function notPurchasable(
        string $brand,
        string $reason,
        string $lifecycle,
        string $source
    ): array {
        $identity = $this->resolveBrandIdentity($brand);

        return [
            'code' => $identity['code'],
            'label' => $identity['label'],
            'delivery' => 'unknown',
            'fields' => [],
            'source' => $source,
            'schema_key' => null,
            'provenance' => null,
            'purchasable' => false,
            'not_purchasable_reason' => $reason,
            'lifecycle' => $lifecycle,
        ];
    }

    /**
     * @return array{code:string,label:string}
     */
    protected function resolveBrandIdentity(string $brand): array
    {
        $profile = $this->matchGameProfile($brand);
        if ($profile !== null) {
            return ['code' => $profile['code'], 'label' => $profile['label']];
        }

        $nick = $this->matchNicknameBrand($brand);
        if ($nick !== null) {
            return ['code' => $nick['code'], 'label' => $nick['label']];
        }

        $brandNorm = $this->normalize($brand);
        $fallbackCode = Str::slug($brandNorm !== '' ? $brandNorm : 'game');
        if ($fallbackCode === '') {
            $fallbackCode = 'game';
        }

        return [
            'code' => $fallbackCode,
            'label' => $brand !== '' ? $brand : 'Game',
        ];
    }

    /**
     * @return array{code:string,label:string}|null
     */
    protected function matchNicknameBrand(string $brand): ?array
    {
        $brandNorm = $this->normalize($brand);
        if ($brandNorm === '') {
            return null;
        }

        $codes = config('gurky_game.nickname_codes', []);
        foreach ($codes as $code => $meta) {
            if (! is_array($meta)) {
                continue;
            }
            if ($this->brandMatches($brandNorm, (string) $code, $meta)) {
                return [
                    'code' => (string) $code,
                    'label' => (string) ($meta['label'] ?? $brand),
                ];
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    protected function brandMatches(string $brandNorm, string $code, array $meta): bool
    {
        $aliases = array_map(fn ($a) => $this->normalize((string) $a), $meta['aliases'] ?? []);
        $labelNorm = $this->normalize((string) ($meta['label'] ?? ''));

        if ($brandNorm === $this->normalize($code) || $brandNorm === $labelNorm) {
            return true;
        }
        if (in_array($brandNorm, $aliases, true)) {
            return true;
        }
        if ($labelNorm !== '' && str_contains($brandNorm, $labelNorm)) {
            return true;
        }

        foreach ($aliases as $a) {
            if ($a !== '' && (str_contains($brandNorm, $a) || str_contains($a, $brandNorm))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  mixed  $raw
     * @return array{source:string,evidence:string,confidence:string}|null
     */
    protected function normalizeProvenance(mixed $raw): ?array
    {
        if (! is_array($raw)) {
            return null;
        }
        $source = trim((string) ($raw['source'] ?? ''));
        $evidence = trim((string) ($raw['evidence'] ?? ''));
        $confidence = trim((string) ($raw['confidence'] ?? 'verified'));
        if ($source === '' || $evidence === '') {
            return null;
        }

        return [
            'source' => $source,
            'evidence' => $evidence,
            'confidence' => $confidence !== '' ? $confidence : 'verified',
        ];
    }

    /**
     * @param  array<int, mixed>  $fields
     * @return list<SchemaField>
     */
    protected function normalizeFields(array $fields): array
    {
        $out = [];
        foreach ($fields as $field) {
            if (! is_array($field)) {
                continue;
            }
            $key = trim((string) ($field['key'] ?? ''));
            if ($key === '') {
                continue;
            }
            $out[] = [
                'key' => $key,
                'label' => trim((string) ($field['label'] ?? $key)) ?: $key,
                'required' => (bool) ($field['required'] ?? true),
            ];
        }

        return $out;
    }

    protected function normalize(string $value): string
    {
        $v = strtolower(trim($value));
        $v = preg_replace('/[^a-z0-9]+/', ' ', $v) ?? $v;

        return trim(preg_replace('/\s+/', ' ', $v) ?? $v);
    }
}
