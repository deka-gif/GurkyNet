<?php

namespace App\Services\Pajak;

use App\Models\Product;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Support\WilayahMatcher;

/**
 * Build Provinsi → Kabupaten/Kota options from live catalog products (PBB/SAMSAT).
 */
class PajakRegionService
{
    public function __construct(
        protected ProductRepositoryInterface $products,
    ) {}

    /**
     * @return array{provinces: list<array{name: string, cities: list<array{name: string, sku_code: string, product_name: string}>}>}
     */
    public function regionsForCategory(string $categorySlug): array
    {
        $paginated = $this->products->getPaginatedProducts([
            'category' => $categorySlug,
            'per_page' => 500,
            'page' => 1,
        ]);

        /** @var array<string, array<string, array{name: string, sku_code: string, product_name: string}>> $tree */
        $tree = [];

        foreach ($paginated->items() as $product) {
            if (!$product instanceof Product) {
                continue;
            }

            $product->loadMissing('provider');
            $operator = (string) ($product->provider?->name ?? '');
            $city = WilayahMatcher::cityLabel($product->name, $operator);
            $province = WilayahMatcher::resolveProvince($city . ' ' . $product->name . ' ' . $operator);
            $cityKey = WilayahMatcher::norm($city);
            if ($cityKey === '') {
                continue;
            }

            // Prefer first visible SKU per city key.
            if (!isset($tree[$province][$cityKey])) {
                $tree[$province][$cityKey] = [
                    'name' => $city,
                    'sku_code' => $product->sku_code,
                    'product_name' => $product->name,
                ];
            }
        }

        ksort($tree, SORT_NATURAL | SORT_FLAG_CASE);
        $provinces = [];
        foreach ($tree as $provinceName => $cities) {
            ksort($cities, SORT_NATURAL | SORT_FLAG_CASE);
            $provinces[] = [
                'name' => $provinceName,
                'cities' => array_values($cities),
            ];
        }

        return ['provinces' => $provinces];
    }
}
