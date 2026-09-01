<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Read-only. Menampilkan setiap baris Provider (brand) yang sedang dipakai produk
 * Voucher Digital, lengkap dengan jumlah produk per sumber (Digiflazz/VIP) dan contoh
 * nama — supaya brand duplikat bisa dikonfirmasi dari data asli sebelum/sesudah merge.
 */
class DiagnoseVoucherDigitalBrandsCommand extends Command
{
    protected $signature = 'gurkynet:diagnose-voucher-digital-brands';

    protected $description = 'Read-only: daftar Provider (brand) + jumlah produk untuk kategori Voucher Digital, dipecah per Digiflazz/VIP.';

    public function handle(): int
    {
        $products = Product::withTrashed()
            ->with(['category', 'provider', 'productProvider'])
            ->whereHas('category', fn ($q) => $q->where('slug', 'voucher-digital'))
            ->get();

        if ($products->isEmpty()) {
            $this->info('Tidak ada produk pada kategori voucher-digital.');

            return self::SUCCESS;
        }

        $grouped = $products->groupBy(fn (Product $p) => (string) ($p->provider?->name ?? '(tanpa brand)'));

        $rows = [];
        foreach ($grouped as $brandName => $group) {
            $byProvider = $group->groupBy(fn (Product $p) => (string) ($p->productProvider?->code ?? '?'));
            $providerBreakdown = $byProvider->map(fn ($g, $code) => $code.'='.$g->count())->values()->implode(', ');

            $sample = $group->first();

            $rows[] = [
                'provider_id' => $sample->provider_id,
                'brand_name' => $brandName,
                'total_products' => $group->count(),
                'per_provider' => $providerBreakdown,
                'sample_sku' => $sample->sku_code,
                'sample_name' => Str::limit((string) $sample->name, 40),
            ];
        }

        usort($rows, fn ($a, $b) => strcasecmp($a['brand_name'], $b['brand_name']));

        $this->table(
            ['Provider ID', 'Brand (nama tile)', 'Total produk', 'Per-provider', 'Contoh SKU', 'Contoh nama'],
            $rows
        );

        $this->info(sprintf('Total %d brand row berbeda untuk kategori voucher-digital.', count($rows)));

        return self::SUCCESS;
    }
}
