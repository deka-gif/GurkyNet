<?php

namespace App\Actions\Admin\Marketing;

use App\Models\CategoryIcon;
use Illuminate\Validation\ValidationException;

class MarketingCategoryIconAction
{
    /**
     * @return list<array{hubId:string,hubLabel:string,hubKey:string,hubIconPath:?string,children:list<array{key:string,label:string,iconPath:?string}>}>
     */
    public function list(): array
    {
        $keys = config('category_icon_keys', []);
        $rows = CategoryIcon::query()->pluck('icon_path', 'key');

        $out = [];
        foreach ($keys as $hubId => $hub) {
            $hubKey = "hub:{$hubId}";
            $children = [];
            foreach (($hub['children'] ?? []) as $childKey => $childLabel) {
                $subKey = "sub:{$hubId}:{$childKey}";
                $children[] = [
                    'key' => $subKey,
                    'label' => $childLabel,
                    'iconPath' => $rows[$subKey] ?? null,
                ];
            }

            $out[] = [
                'hubId' => $hubId,
                'hubLabel' => $hub['label'] ?? $hubId,
                'hubKey' => $hubKey,
                'hubIconPath' => $rows[$hubKey] ?? null,
                'children' => $children,
            ];
        }

        return $out;
    }

    public function setIcon(string $key, ?string $iconPath): CategoryIcon
    {
        if (! $this->isKnownKey($key)) {
            throw ValidationException::withMessages([
                'key' => ["Key kategori '{$key}' tidak dikenal."],
            ]);
        }

        return CategoryIcon::updateOrCreate(['key' => $key], ['icon_path' => $iconPath]);
    }

    /**
     * Flat key => icon_path map for customer-facing consumption. Only non-null entries.
     *
     * @return array<string,string>
     */
    public function publicMap(): array
    {
        return CategoryIcon::query()
            ->whereNotNull('icon_path')
            ->pluck('icon_path', 'key')
            ->all();
    }

    protected function isKnownKey(string $key): bool
    {
        $keys = config('category_icon_keys', []);
        foreach ($keys as $hubId => $hub) {
            if ($key === "hub:{$hubId}") {
                return true;
            }
            foreach (array_keys($hub['children'] ?? []) as $childKey) {
                if ($key === "sub:{$hubId}:{$childKey}") {
                    return true;
                }
            }
        }

        return false;
    }
}
