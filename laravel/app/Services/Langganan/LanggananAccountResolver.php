<?php

namespace App\Services\Langganan;

use Illuminate\Support\Str;

/**
 * Resolves Langganan Digital account field schema from brand / provider name.
 */
class LanggananAccountResolver
{
    /**
     * @return array{code:string,label:string,delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}
     */
    public function resolve(string $brand): array
    {
        $brandNorm = $this->normalize($brand);
        $schemas = config('gurky_langganan.brand_schemas', []);

        foreach ($schemas as $code => $meta) {
            if (!is_array($meta)) {
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
                    'delivery' => (string) ($meta['delivery'] ?? 'voucher'),
                    'fields' => $this->normalizeFields($meta['fields'] ?? []),
                ];
            }
        }

        return [
            'code' => Str::slug($brandNorm !== '' ? $brandNorm : 'langganan'),
            'label' => trim($brand) !== '' ? trim($brand) : 'Langganan Digital',
            'delivery' => (string) config('gurky_langganan.default_delivery', 'voucher'),
            'fields' => $this->normalizeFields(config('gurky_langganan.default_fields', [])),
        ];
    }

    /**
     * @param  array<int, mixed>  $fields
     * @return list<array{key:string,label:string,required:bool,input:string}>
     */
    protected function normalizeFields(array $fields): array
    {
        $out = [];
        foreach ($fields as $field) {
            if (!is_array($field)) {
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
}
