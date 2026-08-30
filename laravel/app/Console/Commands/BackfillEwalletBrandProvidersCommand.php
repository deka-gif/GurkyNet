<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\Provider;
use App\Services\Catalog\EwalletBrandResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * One-time (idempotent) fix: re-assign existing topup-digital products stuck on a
 * generic "E-Money" Provider to the real wallet brand parsed from each product name.
 */
class BackfillEwalletBrandProvidersCommand extends Command
{
    protected $signature = 'ewallet:backfill-brand-providers';

    protected $description = 'Re-assign topup-digital products from generic E-Money brand to per-wallet Provider rows';

    public function handle(EwalletBrandResolver $resolver): int
    {
        $products = Product::withTrashed()
            ->whereHas('category', fn ($q) => $q->where('slug', 'topup-digital'))
            ->with(['category', 'provider'])
            ->get();

        if ($products->isEmpty()) {
            $this->info('No topup-digital products found — nothing to do.');

            return self::SUCCESS;
        }

        $reassigned = 0;
        $skippedNoWallet = 0;
        $alreadyCorrect = 0;

        foreach ($products as $product) {
            $currentName = (string) ($product->provider?->name ?? '');
            if ($currentName !== '' && ! $resolver->isGenericBrand($currentName)) {
                $alreadyCorrect++;

                continue;
            }

            $wallet = $resolver->extractWallet((string) $product->name);
            if ($wallet === null) {
                $skippedNoWallet++;
                $this->warn("  - #{$product->id} \"{$product->name}\" — no wallet keyword found in name, left as-is.");

                continue;
            }

            if ($product->provider && $product->provider->name === $wallet) {
                $alreadyCorrect++;

                continue;
            }

            $provider = Provider::withTrashed()->firstOrNew(['name' => $wallet]);
            if ($provider->trashed()) {
                $provider->restore();
            }
            $provider->fill([
                'logo' => $provider->logo ?: (Str::slug($wallet) . '.png'),
                'is_active' => true,
            ]);
            $provider->save();

            $product->provider_id = $provider->id;
            $product->save();
            $reassigned++;
            $this->line("  - #{$product->id} \"{$product->name}\" -> {$wallet}");
        }

        $this->newLine();
        $this->table(
            ['Metric', 'Count'],
            [
                ['Reassigned to a wallet Provider', $reassigned],
                ['Already correct', $alreadyCorrect],
                ['Skipped (no wallet keyword found in name)', $skippedNoWallet],
            ]
        );

        return self::SUCCESS;
    }
}
