<?php

namespace App\Services\Langganan;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductProvider;
use Illuminate\Support\Str;

/**
 * Resolves Langganan Digital account field schema.
 *
 * Priority (provider-isolated):
 *   explicit SKU → provider metadata (Digi desc / VIP note) → verified brand → UNKNOWN
 *
 * DigiFlazz SKU/desc never applies to VIP products.
 * VIP note never applies to Digi products.
 * Never UNKNOWN → voucher.
 */
class LanggananAccountResolver
{
    public const CATALOG_DIGI = 'digiflazz';

    public const CATALOG_VIP = 'vip';

    /**
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}
     */
    public function resolveForProduct(string $brand, ?string $skuCode = null): array
    {
        $skuRaw = trim((string) $skuCode);
        $sku = strtoupper($skuRaw);
        $catalog = $this->detectCatalogSource($skuRaw);

        if ($sku !== '') {
            $skuHit = $this->matchExplicitSku($skuRaw, $catalog);
            if ($skuHit !== null) {
                return $skuHit;
            }
        }

        if ($skuRaw !== '' && $this->mayUseDigiflazzMetadata($catalog, $skuRaw)) {
            $fromDesc = app(LanggananDigiflazzHintReader::class)->read($skuRaw);
            if ($fromDesc !== null) {
                return [
                    'code' => Str::slug($skuRaw),
                    'label' => trim($brand) !== '' ? trim($brand) : 'Langganan Digital',
                    'delivery' => (string) ($fromDesc['delivery'] ?? 'unknown'),
                    'fields' => $this->normalizeFields($fromDesc['fields'] ?? []),
                ];
            }

            // Digi product/row without clear desc: still allow verified brand fallback
            // (e.g. Vidio VIP-style brand voucher) only when not forced unknown by sku map.
        }

        if ($skuRaw !== '' && $catalog === self::CATALOG_VIP) {
            $fromNote = app(LanggananVipNoteHintReader::class)->read($skuRaw);
            if ($fromNote !== null) {
                return [
                    'code' => Str::slug($skuRaw),
                    'label' => trim($brand) !== '' ? trim($brand) : 'Langganan Digital',
                    'delivery' => (string) ($fromNote['delivery'] ?? 'unknown'),
                    'fields' => $this->normalizeFields($fromNote['fields'] ?? []),
                ];
            }
        }

        return $this->resolve($brand);
    }

    /**
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}
     */
    public function resolve(string $brand): array
    {
        $brandNorm = $this->normalize($brand);
        $schemas = config('gurky_langganan.brand_schemas', []);

        foreach ($schemas as $code => $meta) {
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
                    'delivery' => (string) ($meta['delivery'] ?? 'unknown'),
                    'fields' => $this->normalizeFields($meta['fields'] ?? []),
                ];
            }
        }

        return [
            'code' => Str::slug($brandNorm !== '' ? $brandNorm : 'langganan'),
            'label' => trim($brand) !== '' ? trim($brand) : 'Langganan Digital',
            'delivery' => (string) config('gurky_langganan.default_delivery', 'unknown'),
            'fields' => $this->normalizeFields(config('gurky_langganan.default_fields', [])),
        ];
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

        return DigiflazzProduct::query()->where('buyer_sku_code', $sku)->exists();
    }

    /**
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}|null
     */
    protected function matchExplicitSku(string $sku, ?string $catalog): ?array
    {
        $digiSchemas = config('gurky_langganan.sku_schemas', []);
        $vipSchemas = config('gurky_langganan.vip_sku_schemas', []);

        if ($catalog === self::CATALOG_VIP) {
            return $this->findSkuMeta($vipSchemas, $sku);
        }

        if ($catalog === self::CATALOG_DIGI) {
            return $this->findSkuMeta($digiSchemas, $sku);
        }

        if (str_starts_with(strtoupper($sku), 'VIP-')) {
            return $this->findSkuMeta($vipSchemas, $sku);
        }

        $digiHit = $this->findSkuMeta($digiSchemas, $sku);
        if ($digiHit !== null) {
            return $digiHit;
        }

        return $this->findSkuMeta($vipSchemas, $sku);
    }

    /**
     * @param  array<string, mixed>  $schemas
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}|null
     */
    protected function findSkuMeta(array $schemas, string $sku): ?array
    {
        if (! is_array($schemas) || $schemas === []) {
            return null;
        }

        foreach ($schemas as $code => $meta) {
            if (! is_array($meta)) {
                continue;
            }
            if (strcasecmp((string) $code, $sku) === 0) {
                return $this->formatSchemaEntry($meta, '', (string) $code);
            }
            if (str_starts_with(strtoupper($sku), 'VIP-')
                && strcasecmp((string) $code, substr($sku, 4)) === 0
            ) {
                return $this->formatSchemaEntry($meta, '', (string) $code);
            }
        }

        return null;
    }

    /**
     * @param  array<int, mixed>  $fields
     * @return list<array{key:string,label:string,required:bool,input:string}>
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
                'input' => trim((string) ($field['input'] ?? 'text')) ?: 'text',
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

    /**
     * @param  array<string, mixed>  $meta
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}
     */
    protected function formatSchemaEntry(array $meta, string $brand, string $code): array
    {
        $delivery = strtolower(trim((string) ($meta['delivery'] ?? 'unknown')));
        if (! in_array($delivery, ['account', 'voucher', 'unknown'], true)) {
            $delivery = 'unknown';
        }

        return [
            'code' => (string) ($meta['code'] ?? Str::slug($code)),
            'label' => (string) ($meta['label'] ?? (trim($brand) !== '' ? trim($brand) : 'Langganan Digital')),
            'delivery' => $delivery,
            'fields' => $delivery === 'account'
                ? $this->normalizeFields($meta['fields'] ?? [])
                : [],
        ];
    }
}
