<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\Provider;
use App\Services\Catalog\TelecomOperatorBrandResolver;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Backfill: remap products.telecom operator brands to canonical Provider rows.
 * Mirrors gurkynet:merge-voucher-digital-brands — run with --dry-run first.
 */
class MergeTelecomOperatorBrandsCommand extends Command
{
    protected $signature = 'gurkynet:merge-telecom-operator-brands {--dry-run : Preview only}';

    protected $description = 'Remap pulsa/data telecom operator brands (e.g. SMART -> Smartfren) to canonical Provider rows.';

    public function handle(TelecomOperatorBrandResolver $resolver): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $products = Product::withTrashed()
            ->with(['category', 'provider'])
            ->whereHas('category', fn ($q) => $q->whereIn('slug', TelecomOperatorBrandResolver::TELECOM_CATEGORY_SLUGS))
            ->get();

        $changes = [];
        foreach ($products as $product) {
            $slug = (string) ($product->category?->slug ?? '');
            if (!$resolver->appliesToCategory($slug)) {
                continue;
            }

            $currentName = (string) ($product->provider?->name ?? '');
            $canonical = $resolver->resolve($currentName, (string) $product->name);
            if ($canonical === null || $canonical === $currentName) {
                continue;
            }

            $changes[] = [
                'product_id' => $product->id,
                'sku_code' => $product->sku_code,
                'from' => $currentName,
                'to' => $canonical,
            ];
        }

        if ($changes === []) {
            $this->info('Tidak ada produk telecom yang perlu di-remap.');

            return self::SUCCESS;
        }

        $this->table(['Product ID', 'SKU', 'Brand lama', 'Brand kanonik'], $changes);

        if ($dryRun) {
            $this->comment('--dry-run aktif: tidak ada perubahan ditulis.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($changes) {
            $canonicalProviderIds = [];
            foreach ($changes as $change) {
                $canonicalName = $change['to'];
                if (!isset($canonicalProviderIds[$canonicalName])) {
                    $provider = Provider::withTrashed()->firstOrNew(['name' => $canonicalName]);
                    if ($provider->trashed()) {
                        $provider->restore();
                    }
                    $provider->fill([
                        'logo' => $provider->logo ?: (Str::slug($canonicalName).'.png'),
                        'is_active' => true,
                    ]);
                    $provider->save();
                    $canonicalProviderIds[$canonicalName] = $provider->id;
                }

                Product::withTrashed()
                    ->where('id', $change['product_id'])
                    ->update(['provider_id' => $canonicalProviderIds[$canonicalName]]);
            }
        });

        ProductCatalogCache::bump();
        $this->info('Remap selesai. Jalankan catalog sync jika perlu memperbarui offer VIP/Digi.');

        return self::SUCCESS;
    }
}
