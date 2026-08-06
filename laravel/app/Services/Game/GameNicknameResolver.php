<?php

namespace App\Services\Game;

use Illuminate\Support\Str;

/**
 * Resolves VIP get-nickname game codes + account field schema from brand / operator name.
 */
class GameNicknameResolver
{
    /**
     * @return array{code:string,label:string,fields:list<array{key:string,label:string,required:bool}>}
     */
    public function resolve(string $brand): array
    {
        $brandNorm = $this->normalize($brand);
        $codes = config('gurky_game.nickname_codes', []);

        foreach ($codes as $code => $meta) {
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
                    'fields' => $this->normalizeFields($meta['fields'] ?? []),
                ];
            }
        }

        $fallbackCode = Str::slug($brandNorm !== '' ? $brandNorm : 'game');
        if ($fallbackCode === '') {
            $fallbackCode = 'game';
        }

        return [
            'code' => $fallbackCode,
            'label' => trim($brand) !== '' ? trim($brand) : 'Game',
            'fields' => $this->normalizeFields(config('gurky_game.default_fields', [])),
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
            ];
        }

        if ($out === []) {
            $out[] = [
                'key' => 'player_id',
                'label' => 'Player ID',
                'required' => true,
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
