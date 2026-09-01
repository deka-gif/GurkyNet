<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\Provider;
use App\Services\Catalog\VoucherBrandResolver;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Backfill sekali jalan: meng-assign ulang Product.provider_id untuk produk Voucher
 * Digital yang SUDAH ADA di database, supaya offer Digiflazz dan VIP untuk brand
 * komersial yang sama (mis. "Steam Wallet (IDR)" + "Steam Wallet Code" -> "Steam Wallet")
 * berbagi SATU baris `providers` kanonik — persis yang sekarang dilakukan ingestion untuk
 * sync baru (lihat ProviderRepository::syncWithDigiflazz / SyncVipCatalogAction::upsertOperator).
 *
 * Read-only kalau --dry-run dipakai; hanya menulis ke `products.provider_id` kalau
 * dijalankan TANPA --dry-run. TIDAK PERNAH menghapus baris `providers`, `products`,
 * `product_providers`, atau `digiflazz_products` — baris Provider lama yang jadi
 * "yatim" (0 produk) dibiarkan saja, tidak berbahaya.
 */
class MergeVoucherDigitalBrandsCommand extends Command
{
    protected $signature = 'gurkynet:merge-voucher-digital-brands {--dry-run : Hanya tampilkan apa yang akan berubah, tidak menulis apa pun}';

    protected $description = 'Menyatukan baris brand Digiflazz/VIP yang duplikat untuk kategori Voucher Digital ke satu Provider kanonik (--dry-run dulu untuk pratinjau).';

    public function handle(VoucherBrandResolver $resolver): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $products = Product::withTrashed()
            ->with(['category', 'provider'])
            ->whereHas('category', fn ($q) => $q->where('slug', 'voucher-digital'))
            ->get();

        $changes = [];
        foreach ($products as $product) {
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

        if (empty($changes)) {
            $this->info('Tidak ada produk Voucher Digital yang perlu di-remap. Brand sudah unik.');

            return self::SUCCESS;
        }

        $this->table(['Product ID', 'SKU', 'Brand lama', 'Brand kanonik baru'], $changes);
        $this->info(sprintf('Total %d produk akan di-remap ke brand kanonik.', count($changes)));

        if ($dryRun) {
            $this->comment('--dry-run aktif: TIDAK ADA perubahan yang ditulis ke database.');

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

        $this->info('Selesai. Cache katalog sudah di-bump.');

        return self::SUCCESS;
    }
}
