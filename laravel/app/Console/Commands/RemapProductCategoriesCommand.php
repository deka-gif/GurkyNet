<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Services\Catalog\ProductMappingService;
use Illuminate\Console\Command;

/**
 * Re-assign product_category_id using GurkyNet Product Mapping Layer.
 * Safe to run after IA upgrade so existing Digi/VIP rows land in correct hubs.
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

        Product::with(['category', 'provider'])->chunkById(200, function ($products) use ($mapping, $dry, &$changed, &$unchanged, &$unmapped) {
            foreach ($products as $product) {
                $providerHint = $product->product_provider_id ? 'digiflazz' : 'digiflazz';
                $rawCategory = (string) ($product->category?->name ?? $product->category?->slug ?? '');
                $brand = (string) ($product->provider?->name ?? '');
                $name = (string) ($product->name ?? '');

                $mapped = $mapping->map($providerHint, $rawCategory, $brand, $name);
                if (($mapped['source'] ?? '') === 'unmapped_fallback') {
                    $unmapped[$rawCategory.'|'.$brand] = ($unmapped[$rawCategory.'|'.$brand] ?? 0) + 1;
                }

                if ($product->category?->slug === $mapped['slug']) {
                    $unchanged++;
                    continue;
                }

                $category = ProductCategory::firstOrCreate(
                    ['slug' => $mapped['slug']],
                    ['name' => $mapped['name'], 'icon' => 'box']
                );

                $this->line(($dry ? '[dry] ' : '')."{$product->sku_code}: {$product->category?->slug} → {$mapped['slug']} ({$mapped['source']})");

                if (!$dry) {
                    $product->product_category_id = $category->id;
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
}
