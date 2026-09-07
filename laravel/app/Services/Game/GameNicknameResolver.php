<?php

namespace App\Services\Game;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductProvider;
use Illuminate\Support\Str;

/**
 * Resolves game account schema + VIP get-nickname code.
 *
 * Priority (provider-isolated):
 *   explicit SKU (scoped) → provider metadata → verified brand (VIP nickname_codes) → UNKNOWN
 *
 * Digiflazz products NEVER inherit VIP brand fields without Digi evidence.
 * VIP products NEVER inherit Digiflazz desc.
 * Never invents player_id / zone for unknown products.
 */
class GameNicknameResolver
{
    public const CATALOG_DIGI = 'digiflazz';

    public const CATALOG_VIP = 'vip';

    /**
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool}>,source:string}
     */
    public function resolveForProduct(string $brand, ?string $skuCode = null): array
    {
        $sku = trim((string) $skuCode);
        $brandTrim = trim($brand);
        $catalog = $this->detectCatalogSource($sku);

        if ($sku !== '') {
            $skuHit = $this->matchExplicitSku($sku, $catalog);
            if ($skuHit !== null) {
                return $skuHit;
            }
        }

        if ($sku !== '' && $this->mayUseDigiflazzMetadata($catalog, $sku)) {
            $fromDesc = app(GameDigiflazzHintReader::class)->read($sku);
            if ($fromDesc !== null) {
                $brandResolved = $this->resolveBrandOnly($brandTrim);

                return [
                    'code' => $brandResolved['code'],
                    'label' => $brandResolved['label'] !== 'Game' || $brandTrim === ''
                        ? $brandResolved['label']
                        : ($brandTrim !== '' ? $brandTrim : 'Game'),
                    'delivery' => (string) ($fromDesc['delivery'] ?? 'account'),
                    'fields' => $this->normalizeFields($fromDesc['fields'] ?? []),
                    'source' => 'digiflazz_desc',
                ];
            }

            // Digi row / Digi product without clear desc → fail-closed (do not use VIP brand).
            if ($catalog === self::CATALOG_DIGI || $this->hasDigiflazzRow($sku)) {
                return $this->unknownSchema($brandTrim);
            }
        }

        // VIPPayment temporarily OFF for customer schema/UI (DigiFlazz = sole active SoT).
        // Keep VIP note/brand helpers in codebase for future failover — do not drive forms now.
        if ($catalog === self::CATALOG_VIP) {
            return $this->unknownSchema($brandTrim);
        }

        // Brand nickname_codes remain available for Digi nickname-code resolution helpers
        // and brand-only legacy calls without SKU — not for VIP catalog products.
        if ($catalog !== self::CATALOG_DIGI) {
            $brandHit = $this->matchBrand($brandTrim);
            if ($brandHit !== null) {
                return $brandHit;
            }
        }

        return $this->unknownSchema($brandTrim);
    }

    /**
     * Brand-only resolve (legacy). Prefer resolveForProduct when SKU is known.
     *
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool}>,source:string}
     */
    public function resolve(string $brand): array
    {
        return $this->resolveForProduct($brand, null);
    }

    /** Digi lookup/utility SKUs (e.g. Cek Username) — not top-up purchase products. */
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

    protected function mayUseDigiflazzMetadata(?string $catalog, string $sku): bool
    {
        if ($catalog === self::CATALOG_VIP) {
            return false;
        }
        if ($catalog === self::CATALOG_DIGI) {
            return true;
        }

        // Ambiguous SKU: Digi metadata only if Digi catalog row exists and SKU is not VIP-prefixed.
        return $this->hasDigiflazzRow($sku);
    }

    protected function hasDigiflazzRow(string $sku): bool
    {
        return DigiflazzProduct::query()
            ->where('buyer_sku_code', $sku)
            ->exists();
    }

    /**
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool}>,source:string}|null
     */
    protected function matchExplicitSku(string $sku, ?string $catalog): ?array
    {
        $digiSchemas = config('gurky_game.sku_schemas', []);
        $vipSchemas = config('gurky_game.vip_sku_schemas', []);

        if ($catalog === self::CATALOG_VIP) {
            return $this->findSkuMeta($vipSchemas, $sku, 'vip_sku_schema');
        }

        if ($catalog === self::CATALOG_DIGI) {
            return $this->findSkuMeta($digiSchemas, $sku, 'sku_schema');
        }

        // Ambiguous: Digi-only SKU map if Digi row exists; never apply Digi map to VIP- SKUs.
        if (str_starts_with(strtoupper($sku), 'VIP-')) {
            return $this->findSkuMeta($vipSchemas, $sku, 'vip_sku_schema');
        }

        $digiHit = $this->findSkuMeta($digiSchemas, $sku, 'sku_schema');
        if ($digiHit !== null) {
            return $digiHit;
        }

        return $this->findSkuMeta($vipSchemas, $sku, 'vip_sku_schema');
    }

    /**
     * @param  array<string, mixed>  $schemas
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool}>,source:string}|null
     */
    protected function findSkuMeta(array $schemas, string $sku, string $source): ?array
    {
        if (! is_array($schemas) || $schemas === []) {
            return null;
        }

        foreach ($schemas as $code => $meta) {
            if (! is_array($meta)) {
                continue;
            }
            if (strcasecmp((string) $code, $sku) === 0) {
                return $this->formatEntry($meta, '', (string) $code, $source);
            }
            // VIP internal sku VIP-{code}
            if (str_starts_with(strtoupper($sku), 'VIP-')
                && strcasecmp((string) $code, substr($sku, 4)) === 0
            ) {
                return $this->formatEntry($meta, '', (string) $code, $source);
            }
        }

        return null;
    }

    /**
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool}>,source:string}|null
     */
    protected function matchBrand(string $brand): ?array
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
            $aliases = array_map(fn ($a) => $this->normalize((string) $a), $meta['aliases'] ?? []);
            $labelNorm = $this->normalize((string) ($meta['label'] ?? ''));
            if ($brandNorm === $this->normalize((string) $code)
                || $brandNorm === $labelNorm
                || in_array($brandNorm, $aliases, true)
                || ($labelNorm !== '' && str_contains($brandNorm, $labelNorm))
                || collect($aliases)->contains(fn ($a) => $a !== '' && (str_contains($brandNorm, $a) || str_contains($a, $brandNorm)))
            ) {
                return [
                    'code' => (string) $code,
                    'label' => (string) ($meta['label'] ?? $brand),
                    'delivery' => 'account',
                    'fields' => $this->normalizeFields($meta['fields'] ?? []),
                    'source' => 'brand',
                ];
            }
        }

        return null;
    }

    /**
     * @return array{code:string,label:string}
     */
    protected function resolveBrandOnly(string $brand): array
    {
        $hit = $this->matchBrand($brand);
        if ($hit !== null) {
            return ['code' => $hit['code'], 'label' => $hit['label']];
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
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool}>,source:string}
     */
    protected function unknownSchema(string $brand): array
    {
        $brandNorm = $this->normalize($brand);
        $fallbackCode = Str::slug($brandNorm !== '' ? $brandNorm : 'game');
        if ($fallbackCode === '') {
            $fallbackCode = 'game';
        }

        return [
            'code' => $fallbackCode,
            'label' => $brand !== '' ? $brand : 'Game',
            'delivery' => 'unknown',
            'fields' => [],
            'source' => 'unknown',
        ];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool}>,source:string}
     */
    protected function formatEntry(array $meta, string $brand, string $code, string $source): array
    {
        $delivery = strtolower(trim((string) ($meta['delivery'] ?? 'unknown')));
        if (! in_array($delivery, ['account', 'unknown'], true)) {
            $delivery = 'unknown';
        }

        $fields = $delivery === 'account'
            ? $this->normalizeFields($meta['fields'] ?? [])
            : [];

        $brandOnly = $this->resolveBrandOnly($brand);

        return [
            'code' => (string) ($meta['code'] ?? ($brandOnly['code'] !== 'game' ? $brandOnly['code'] : Str::slug($code))),
            'label' => (string) ($meta['label'] ?? ($brandOnly['label'] !== 'Game' ? $brandOnly['label'] : $code)),
            'delivery' => $delivery,
            'fields' => $fields,
            'source' => $source,
        ];
    }

    /**
     * @param  array<int, mixed>  $fields
     * @return list<array{key:string,label:string,required:bool}>
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
