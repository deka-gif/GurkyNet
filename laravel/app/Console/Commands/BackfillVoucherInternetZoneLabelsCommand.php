<?php

namespace App\Console\Commands;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Services\Catalog\VoucherInternetZoneLabelResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillVoucherInternetZoneLabelsCommand extends Command
{
    protected $signature = 'catalog:backfill-voucher-internet-zone-labels
                            {--provider=Telkomsel : Operator brand name filter (providers.name)}';

    protected $description = 'One-time backfill of products.zone_label for voucher-internet from VIP meta / Digiflazz type.';

    public function handle(VoucherInternetZoneLabelResolver $resolver): int
    {
        $providerFilter = (string) $this->option('provider');
        $vipId = ProductProvider::query()->where('code', 'vip')->value('id');

        $query = Product::query()
            ->with('category')
            ->whereHas('category', fn ($q) => $q->where('slug', VoucherInternetZoneLabelResolver::CATEGORY_SLUG))
            ->whereHas('provider', function ($q) use ($providerFilter) {
                $q->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($providerFilter).'%']);
            });

        $total = (clone $query)->count();
        $filled = 0;
        $nulled = 0;

        $query->orderBy('id')->chunkById(100, function ($products) use ($resolver, $vipId, &$filled, &$nulled) {
            foreach ($products as $product) {
                $label = null;

                if ($vipId) {
                    $meta = ProductProviderSku::query()
                        ->where('product_id', $product->id)
                        ->where('product_provider_id', $vipId)
                        ->value('provider_meta');
                    if (is_string($meta)) {
                        $meta = json_decode($meta, true);
                    }
                    $label = $resolver->fromVipProviderMeta(is_array($meta) ? $meta : null, $product->name);
                }

                if ($label === null) {
                    $digiType = DigiflazzProduct::query()
                        ->where('buyer_sku_code', $product->sku_code)
                        ->value('type');
                    $label = $resolver->fromDigiflazzType($digiType, $product->name);
                }

                $product->forceFill(['zone_label' => $label])->save();

                if ($label === null) {
                    $nulled++;
                } else {
                    $filled++;
                }
            }
        });

        $this->info("Backfill complete for {$total} products: zone_label set={$filled}, null(Umum/special)={$nulled}.");

        return self::SUCCESS;
    }
}
