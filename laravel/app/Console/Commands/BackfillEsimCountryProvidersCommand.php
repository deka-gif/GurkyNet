<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\Provider;
use App\Services\Catalog\EsimCountryResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * One-time (idempotent) fix: re-assign existing eSIM products from the single
 * generic "ESIM" Provider to a per-country Provider, parsed from each
 * product's own name — so Marketing can give each country its own logo and
 * the customer-facing eSIM page can group by country.
 */
class BackfillEsimCountryProvidersCommand extends Command
{
    protected $signature = 'esim:backfill-country-providers';

    protected $description = 'Re-assign existing eSIM products from the generic "ESIM" brand to per-country Provider rows';

    public function handle(EsimCountryResolver $resolver): int
    {
        $products = Product::withTrashed()
            ->whereHas('category', fn ($q) => $q->where('slug', 'esim'))
            ->with(['category', 'provider'])
            ->get();

        if ($products->isEmpty()) {
            $this->info('No eSIM products found — nothing to do.');

            return self::SUCCESS;
        }

        $reassigned = 0;
        $skippedNoCountry = 0;
        $alreadyCorrect = 0;

        foreach ($products as $product) {
            $country = $resolver->extractCountry((string) $product->name);
            if ($country === null) {
                $skippedNoCountry++;
                $this->warn("  - #{$product->id} \"{$product->name}\" — no country found in name, left as-is.");

                continue;
            }

            if ($product->provider && $product->provider->name === $country) {
                $alreadyCorrect++;

                continue;
            }

            $provider = Provider::withTrashed()->firstOrNew(['name' => $country]);
            if ($provider->trashed()) {
                $provider->restore();
            }
            $provider->fill([
                'logo' => $provider->logo ?: (Str::slug($country) . '.png'),
                'is_active' => true,
            ]);
            $provider->save();

            $product->provider_id = $provider->id;
            $product->save();
            $reassigned++;
            $this->line("  - #{$product->id} \"{$product->name}\" -> {$country}");
        }

        $this->newLine();
        $this->table(
            ['Metric', 'Count'],
            [
                ['Reassigned to a country Provider', $reassigned],
                ['Already correct', $alreadyCorrect],
                ['Skipped (no country found in name)', $skippedNoCountry],
            ]
        );

        return self::SUCCESS;
    }
}
