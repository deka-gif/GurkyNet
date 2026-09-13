<?php

namespace App\Console\Commands;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Services\Catalog\VoucherInternetZoneLabelResolver;
use Illuminate\Console\Command;

class BackfillVoucherInternetZoneLabelsCommand extends Command
{
    protected $signature = 'catalog:backfill-voucher-internet-zone-labels
                            {--provider=Telkomsel : Operator brand name filter (providers.name)}
                            {--category= : Limit to one category slug (voucher-internet|sms-telepon). Default: both VI + SMS}';

    protected $description = 'Backfill products.zone_label for voucher-internet and sms-telepon from Digi type / VIP meta.';

    public function handle(VoucherInternetZoneLabelResolver $resolver): int
    {
        $providerFilter = (string) $this->option('provider');
        $categoryOpt = trim((string) $this->option('category'));
        $vipId = ProductProvider::query()->where('code', 'vip')->value('id');

        $slugs = [VoucherInternetZoneLabelResolver::CATEGORY_SLUG, ...VoucherInternetZoneLabelResolver::SMS_CATEGORY_SLUGS];
        if ($categoryOpt !== '') {
            if (! $resolver->appliesToCategorySlug($categoryOpt)) {
                $this->error("Category '{$categoryOpt}' is not zone-gated.");

                return self::FAILURE;
            }
            $slugs = [$categoryOpt];
        }

        $query = Product::query()
            ->with('category')
            ->whereHas('category', fn ($q) => $q->whereIn('slug', $slugs))
            ->whereHas('provider', function ($q) use ($providerFilter) {
                $q->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($providerFilter).'%']);
            });

        $total = (clone $query)->count();
        $filled = 0;
        $nulled = 0;

        $query->orderBy('id')->chunkById(100, function ($products) use ($resolver, $vipId, &$filled, &$nulled) {
            foreach ($products as $product) {
                $slug = $product->category?->slug;
                $label = null;

                if ($vipId) {
                    $meta = ProductProviderSku::query()
                        ->where('product_id', $product->id)
                        ->where('product_provider_id', $vipId)
                        ->value('provider_meta');
                    if (is_string($meta)) {
                        $meta = json_decode($meta, true);
                    }
                    $label = $resolver->fromVipProviderMeta(
                        is_array($meta) ? $meta : null,
                        $product->name,
                        $slug
                    );
                }

                if ($label === null) {
                    $digiType = DigiflazzProduct::query()
                        ->where('buyer_sku_code', $product->sku_code)
                        ->value('type');
                    $label = $resolver->fromDigiflazzType($digiType, $product->name, $slug);
                }

                $product->forceFill(['zone_label' => $label])->save();

                if ($label === null) {
                    $nulled++;
                } else {
                    $filled++;
                }
            }
        });

        $this->info('Backfill complete for '.$total.' products ('.implode(',', $slugs)."): zone_label set={$filled}, null={$nulled}.");

        return self::SUCCESS;
    }
}
