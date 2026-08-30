<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;

class DiagnoseCatalogGapsCommand extends Command
{
    protected $signature = 'catalog:diagnose-gaps';

    protected $description = 'Read-only: print eSIM product names/providers and Tagihan category product counts for diagnosis.';

    public function handle(): int
    {
        $this->info('=== eSIM products (name -> current provider) ===');
        $esim = Product::withTrashed()
            ->whereHas('category', fn ($q) => $q->where('slug', 'esim'))
            ->with('provider')
            ->get(['id', 'name', 'provider_id', 'deleted_at']);

        if ($esim->isEmpty()) {
            $this->warn('No eSIM products found at all.');
        }
        foreach ($esim as $p) {
            $this->line(sprintf(
                '#%d | %s | provider: %s%s',
                $p->id,
                $p->name,
                $p->provider?->name ?? 'NULL',
                $p->deleted_at ? ' [TRASHED]' : ''
            ));
        }

        $this->info('');
        $this->info('=== Tagihan category product counts ===');
        $slugs = [
            'pln-pascabayar', 'pdam', 'bpjs-kesehatan', 'bpjs-tk',
            'internet-pascabayar', 'tv-pascabayar', 'gas', 'pbb',
            'samsat', 'multifinance', 'tagihan',
        ];
        foreach ($slugs as $slug) {
            $total = Product::whereHas('category', fn ($q) => $q->where('slug', $slug))->count();
            $active = Product::whereHas('category', fn ($q) => $q->where('slug', $slug))
                ->whereHas('providerSkus', function ($q) {
                    $q->where('product_provider_skus.is_active', true)
                        ->whereHas('productProvider', fn ($pp) => $pp->where('product_providers.is_active', true));
                })
                ->count();
            $this->line(sprintf('%-24s total=%-4d active_and_visible=%d', $slug, $total, $active));
        }

        $this->info('');
        $this->info('=== E-Wallet (topup-digital) providers currently in DB ===');
        $ewallet = Product::withTrashed()
            ->whereHas('category', fn ($q) => $q->where('slug', 'topup-digital'))
            ->with('provider')
            ->get(['id', 'name', 'provider_id', 'deleted_at']);
        foreach ($ewallet as $p) {
            $this->line(sprintf(
                '#%d | %s | provider: %s%s',
                $p->id,
                $p->name,
                $p->provider?->name ?? 'NULL',
                $p->deleted_at ? ' [TRASHED]' : ''
            ));
        }

        return self::SUCCESS;
    }
}
