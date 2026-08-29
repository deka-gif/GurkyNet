<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\ProductRepositoryInterface;
use Illuminate\Support\Str;

class GetCategoryProviderSummaryAction
{
    public function __construct(
        protected ProductRepositoryInterface $productRepository,
    ) {}

    /**
     * @return list<array{providerId: int, name: string, logo: ?string, count: int}>
     */
    public function execute(string $category): array
    {
        $products = $this->productRepository->getActiveProductsForCategory($category);

        /** @var array<string, array{providerId: int, name: string, logo: ?string, count: int}> $groups */
        $groups = [];

        foreach ($products as $product) {
            $name = trim((string) ($product->provider?->name ?? 'Lainnya'));
            if ($name === '') {
                $name = 'Lainnya';
            }

            $key = Str::lower($name);

            if (! isset($groups[$key])) {
                $groups[$key] = [
                    'providerId' => (int) $product->provider_id,
                    'name' => $name,
                    'logo' => $product->provider?->logo,
                    'count' => 1,
                ];
            } else {
                $groups[$key]['count']++;
            }
        }

        $out = array_values($groups);
        usort($out, fn (array $a, array $b) => strcoll($a['name'], $b['name']));

        return $out;
    }
}
