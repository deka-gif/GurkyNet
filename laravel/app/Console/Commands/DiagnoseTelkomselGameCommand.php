<?php

namespace App\Console\Commands;

use App\Models\DigiflazzProduct;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * READ-ONLY diagnostic. Tidak mengubah data apa pun.
 * Menampilkan semua produk dengan nama provider mengandung "Telkomsel",
 * dikelompokkan per kategori saat ini, lengkap dengan sumber mapping-nya
 * dan kategori mentah dari Digiflazz (kalau ada baris digiflazz_products-nya).
 */
class DiagnoseTelkomselGameCommand extends Command
{
    protected $signature = 'gurkynet:diagnose-telkomsel-game';

    protected $description = 'READ-ONLY: daftar semua produk provider Telkomsel beserta kategori & sumber mapping-nya (untuk investigasi Telkomsel nyasar ke kategori Game).';

    public function handle(): int
    {
        $rows = DB::table('products as p')
            ->join('product_categories as pc', 'p.product_category_id', '=', 'pc.id')
            ->join('providers as pr', 'p.provider_id', '=', 'pr.id')
            ->leftJoin('product_provider_skus as pps', 'pps.product_id', '=', 'p.id')
            ->leftJoin('product_providers as pp', 'pp.id', '=', 'pps.product_provider_id')
            ->whereNull('p.deleted_at')
            ->where('pr.name', 'like', '%telkomsel%')
            ->select([
                'p.sku_code',
                'p.name',
                'pr.name as provider_name',
                'pc.slug as current_category',
                'p.category_mapping_source',
                'pps.is_active as sku_is_active',
                'pp.is_active as provider_is_active',
                'pp.code as provider_source',
                'pps.provider_meta',
            ])
            ->orderBy('pc.slug')
            ->orderBy('p.name')
            ->get();

        if ($rows->isEmpty()) {
            $this->warn('Tidak ada produk dengan nama provider mengandung "Telkomsel" ditemukan.');
            return self::SUCCESS;
        }

        $this->info('Total baris ditemukan: '.$rows->count());
        $this->newLine();

        foreach ($rows->groupBy('current_category') as $categorySlug => $group) {
            $this->line("=== kategori saat ini: {$categorySlug} ({$group->count()} baris) ===");

            foreach ($group as $r) {
                $digi = DigiflazzProduct::query()->where('buyer_sku_code', $r->sku_code)->first();

                $metaCategory = null;
                if (!empty($r->provider_meta)) {
                    $decoded = json_decode((string) $r->provider_meta, true);
                    $metaCategory = is_array($decoded) ? ($decoded['category'] ?? $decoded['type'] ?? null) : null;
                }

                $this->line(sprintf(
                    '  SKU=%s | nama="%s" | provider="%s" | mapping_source=%s | sku_active=%s | provider_active=%s | provider_code=%s | digiflazz_category=%s | provider_meta_category=%s',
                    $r->sku_code,
                    $r->name,
                    $r->provider_name,
                    $r->category_mapping_source ?? '(null)',
                    $r->sku_is_active === null ? '(n/a)' : ($r->sku_is_active ? 'yes' : 'no'),
                    $r->provider_is_active === null ? '(n/a)' : ($r->provider_is_active ? 'yes' : 'no'),
                    $r->provider_source ?? '(n/a)',
                    $digi->category ?? '(tidak ada baris digiflazz_products)',
                    $metaCategory ?? '(null)'
                ));
            }

            $this->newLine();
        }

        return self::SUCCESS;
    }
}
