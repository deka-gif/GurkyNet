<?php

namespace App\Console\Commands;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Services\Catalog\ProductMappingService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Re-assign product_category_id using GurkyNet Product Mapping Layer.
 * Safe to run after IA upgrade so existing Digi/VIP rows land in correct hubs.
 *
 * Uses raw provider category from digiflazz_products when available (not the
 * already-mapped product_categories slug).
 */
class RemapProductCategoriesCommand extends Command
{
    protected $signature = 'catalog:remap-categories {--dry-run : Show changes without saving}';

    protected $description = 'Remap product categories to GurkyNet IA via ProductMappingService';

    public function handle(ProductMappingService $mapping): int
    {
        $dry = (bool) $this->option('dry-run');
        $changed = 0;
        $unchanged = 0;
        $unmapped = [];

        $vipProviderIds = ProductProvider::query()
            ->where('code', 'like', 'vip%')
            ->pluck('id')
            ->all();

        Product::with(['category', 'provider', 'productProvider'])->chunkById(200, function ($products) use ($mapping, $dry, &$changed, &$unchanged, &$unmapped, $vipProviderIds) {
            foreach ($products as $product) {
                [$providerHint, $rawCategory, $brand, $isGameHint] = $this->resolveMappingInputs($product, $vipProviderIds);

                $mapped = $mapping->map($providerHint, $rawCategory, $brand, (string) ($product->name ?? ''), $isGameHint);
                if (($mapped['source'] ?? '') === 'unmapped_fallback') {
                    $unmapped[$rawCategory.'|'.$brand] = ($unmapped[$rawCategory.'|'.$brand] ?? 0) + 1;
                }

                $sourceChanged = ($product->category_mapping_source ?? '') !== ($mapped['source'] ?? '');
                $slugChanged = $product->category?->slug !== $mapped['slug'];

                if (!$slugChanged && !$sourceChanged) {
                    $unchanged++;
                    continue;
                }

                $category = ProductCategory::firstOrCreate(
                    ['slug' => $mapped['slug']],
                    ['name' => $mapped['name'], 'icon' => 'box']
                );

                if ($slugChanged) {
                    $this->line(($dry ? '[dry] ' : '')."{$product->sku_code}: {$product->category?->slug} → {$mapped['slug']} ({$mapped['source']})");
                }

                if (!$dry) {
                    $product->product_category_id = $category->id;
                    $product->category_mapping_source = $mapped['source'];
                    $product->save();
                }
                $changed++;
            }
        });

        $this->info("Changed: {$changed}, Unchanged: {$unchanged}");
        if ($unmapped !== []) {
            $this->warn('Samples still on unmapped_fallback (top 20):');
            arsort($unmapped);
            foreach (array_slice($unmapped, 0, 20, true) as $key => $count) {
                $this->line("  {$key} × {$count}");
            }
        }

        return self::SUCCESS;
    }

    /**
     * @return array{0:string,1:string,2:string,3:bool}
     */
    protected function resolveMappingInputs(Product $product, array $vipProviderIds): array
    {
        $brand = (string) ($product->provider?->name ?? '');
        $sku = (string) ($product->sku_code ?? '');

        $isVip = in_array($product->product_provider_id, $vipProviderIds, true)
            || Str::startsWith(Str::upper($sku), 'VIP-');

        if ($isVip) {
            $rawCategory = (string) ($product->category?->slug ?? $product->category?->name ?? 'prepaid');
            $isGame = Str::contains(Str::lower($brand.' '.$product->name), ['diamond', 'game', 'mlbb', 'free fire']);

            return ['vip', $rawCategory, $brand, $isGame];
        }

        $digi = DigiflazzProduct::query()->where('buyer_sku_code', $sku)->first();
        if ($digi) {
            return [
                'digiflazz',
                (string) ($digi->category ?? 'Umum'),
                (string) ($digi->brand ?: $brand),
                false,
            ];
        }

        // Fallback when digiflazz_products row missing — use current slug (legacy behaviour)
        return [
            'digiflazz',
            (string) ($product->category?->slug ?? $product->category?->name ?? ''),
            $brand,
            false,
        ];
    }
}
