<?php

namespace App\Actions\Admin\Marketing;

use App\Models\Provider;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Repositories\Contracts\ProviderRepositoryInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class MarketingBrandLogoAction
{
    public function __construct(
        protected ProductRepositoryInterface $productRepository,
        protected ProviderRepositoryInterface $providerRepository,
    ) {}

    /**
     * Brands (Provider rows) that are ACTUALLY live for customers right now —
     * same visibility gate as the real brand pickers, just across ALL
     * categories instead of one. A brand only appears here if it has at
     * least one product that is genuinely visible today.
     *
     * @return list<array{id:int, name:string, logo:?string, productCount:int, categories:list<string>}>
     */
    public function list(): array
    {
        $products = $this->productRepository->getActiveProducts();

        /** @var array<int, array{id:int, name:string, logo:?string, productCount:int, categories:array<string,string>}> $groups */
        $groups = [];

        foreach ($products as $product) {
            $provider = $product->provider;
            if (! $provider) {
                continue;
            }

            $id = (int) $provider->id;
            if (! isset($groups[$id])) {
                $groups[$id] = [
                    'id' => $id,
                    'name' => $provider->name,
                    'logo' => $provider->logo,
                    'productCount' => 0,
                    'categories' => [],
                ];
            }

            $groups[$id]['productCount']++;

            $categoryName = trim((string) ($product->category?->name ?? ''));
            if ($categoryName !== '') {
                $groups[$id]['categories'][$categoryName] = $categoryName;
            }
        }

        $out = array_values(array_map(function (array $g) {
            $g['categories'] = array_values($g['categories']);
            sort($g['categories']);

            return $g;
        }, $groups));

        usort($out, fn (array $a, array $b) => strcoll($a['name'], $b['name']));

        return $out;
    }

    public function setLogo(int $providerId, string $logo): Provider
    {
        $provider = $this->providerRepository->updateLogo($providerId, $logo);

        if (! $provider) {
            throw new ModelNotFoundException("Provider {$providerId} not found");
        }

        return $provider;
    }
}
