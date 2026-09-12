<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\Catalog\EwalletBrandResolver;
use App\Services\Catalog\ProductPurchaseLifecycleService;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GetCategoryProviderSummaryAction
{
    public function __construct(
        protected ProductRepositoryInterface $productRepository,
        protected ProductPurchaseLifecycleService $lifecycle,
        protected EwalletBrandResolver $ewalletBrands,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function execute(string $category, array $filters = []): array
    {
        $cacheKey = ProductCatalogCache::providerSummaryKey($category, $filters);
        $ttl = 300;
        $loader = function () use ($category, $filters) {
            $products = $this->productRepository->getActiveProductsForCategory($category, $filters);
            $isEwallet = $this->isEwalletCategory($category);

            $groups = [];
            foreach ($products as $product) {
                // Customer purchase grid: only PURCHASABLE SKUs contribute to brand visibility.
                $life = $this->lifecycle->evaluate($product);
                if (! ($life['purchasable'] ?? false) || ! ($life['catalog_visible'] ?? false)) {
                    continue;
                }

                $rawName = trim((string) ($product->provider?->name ?? 'Lainnya'));
                if ($rawName === '') {
                    $rawName = 'Lainnya';
                }

                $displayName = $isEwallet
                    ? $this->ewalletBrands->canonicalize($rawName, (string) $product->name)
                    : $rawName;

                if ($isEwallet && $this->ewalletBrands->isGenericBrand($rawName) && $displayName === $rawName) {
                    // Generic E-MONEY bucket without a resolvable wallet — skip.
                    continue;
                }

                $key = Str::lower($displayName);
                $providerId = (int) $product->provider_id;
                $isOpen = $isEwallet && $this->ewalletBrands->isOpenAmountProduct($product)
                    && ! $this->ewalletBrands->isCekNamaProduct($product);

                if (! isset($groups[$key])) {
                    $groups[$key] = [
                        'providerId' => $providerId,
                        'providerIds' => [$providerId],
                        'name' => $displayName,
                        'logo' => $product->provider?->logo,
                        'count' => 1,
                        'open_amount_sku' => null,
                        'open_amount_product' => null,
                    ];
                } else {
                    $groups[$key]['count']++;
                    if (! in_array($providerId, $groups[$key]['providerIds'], true)) {
                        $groups[$key]['providerIds'][] = $providerId;
                    }
                    if (! $groups[$key]['logo'] && $product->provider?->logo) {
                        $groups[$key]['logo'] = $product->provider->logo;
                    }
                }

                if ($isOpen) {
                    // Prefer Digiflazz pasca Bebas Nominal as the brand's open-amount SKU.
                    $groups[$key]['open_amount_sku'] = (string) $product->sku_code;
                    $groups[$key]['open_amount_product'] = $product;
                    $groups[$key]['providerId'] = $providerId;
                }
            }

            $out = [];
            foreach ($groups as $group) {
                if ($isEwallet) {
                    $openProduct = $group['open_amount_product'] ?? null;
                    if ($openProduct === null) {
                        // E-Wallet customer list: only brands with Bebas Nominal / Pascabayar.
                        continue;
                    }

                    $limits = $this->ewalletBrands->openAmountLimitsForProduct($openProduct);
                    if ($limits === null) {
                        continue;
                    }

                    $out[] = [
                        'providerId' => (int) $group['providerId'],
                        'providerIds' => array_values($group['providerIds']),
                        'name' => $group['name'],
                        'logo' => $group['logo'],
                        'count' => 1,
                        'is_open_amount' => true,
                        'sku_code' => (string) $group['open_amount_sku'],
                        'min_amount' => $limits['min_amount'],
                        'max_amount' => $limits['max_amount'],
                    ];
                    continue;
                }

                $out[] = [
                    'providerId' => (int) $group['providerId'],
                    'name' => $group['name'],
                    'logo' => $group['logo'],
                    'count' => (int) $group['count'],
                ];
            }

            usort($out, fn (array $a, array $b) => strcoll($a['name'], $b['name']));

            return $out;
        };

        try {
            try {
                return Cache::tags(['products', 'active_products'])->remember($cacheKey, $ttl, $loader);
            } catch (\BadMethodCallException) {
                return Cache::remember($cacheKey, $ttl, $loader);
            }
        } catch (\Throwable $e) {
            Log::warning('Category provider summary cache unavailable — serving direct query', [
                'category' => $category,
                'error' => $e->getMessage(),
            ]);

            return $loader();
        }
    }

    protected function isEwalletCategory(string $category): bool
    {
        $slug = Str::lower(trim($category));

        return in_array($slug, ['topup-digital', 'ewallet', 'e-wallet', 'e-money', 'emoney'], true);
    }
}
