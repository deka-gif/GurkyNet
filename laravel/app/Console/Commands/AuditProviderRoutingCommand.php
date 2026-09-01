<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Services\ProductProviders\LogicalProductKey;
use App\Services\ProductProviders\ProductRoutingService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Read-only catalog audit: provider mapping classification per active product.
 * Uses the same ProductRoutingService logic as checkout — no provider API calls.
 */
class AuditProviderRoutingCommand extends Command
{
    protected $signature = 'gurkynet:audit-provider-routing
                            {--category= : Limit to category slug(s), comma-separated}';

    protected $description = 'Read-only: audit Digi-only / VIP-only / Both / no-mapping per active product and routing primary.';

    public function handle(ProductRoutingService $routing): int
    {
        $digi = ProductProvider::digiflazz();
        $vip = ProductProvider::vip();
        $digiId = $digi?->id;
        $vipId = $vip?->id;

        $categoryOpt = trim((string) $this->option('category'));
        $categorySlugs = $categoryOpt !== '' ? array_map('trim', explode(',', $categoryOpt)) : null;

        $query = Product::query()
            ->with(['category', 'provider', 'providerSkus.productProvider'])
            ->whereNull('deleted_at')
            ->where('status', true)
            ->where(function ($q) {
                $q->where('ops_status', 'active')
                    ->orWhereNull('ops_status')
                    ->orWhere('ops_status', '');
            });

        if ($categorySlugs !== null && $categorySlugs !== []) {
            $query->whereHas('category', fn ($q) => $q->whereIn('slug', $categorySlugs));
        }

        $products = $query->orderBy('id')->get();

        $this->info('=== GurkyNet Provider Routing Audit (read-only) ===');
        $this->line('Products scanned: '.$products->count());
        $this->line('Digiflazz provider_id: '.($digiId ?? 'N/A').' | VIP provider_id: '.($vipId ?? 'N/A'));
        $this->newLine();

        $counts = [
            'Digi-only' => 0,
            'VIP-only' => 0,
            'Both' => 0,
            'Tidak ada mapping aktif' => 0,
        ];
        $duplicateWarnings = [];
        $invalidSkuWarnings = [];

        $rows = [];

        foreach ($products as $product) {
            $classification = $this->classifyLogicalGroup($product, $digiId, $vipId);
            $counts[$classification['bucket']]++;
            $invalidSkuWarnings = array_merge($invalidSkuWarnings, $classification['invalid_skus']);

            $ordered = $routing->orderedOffersForProduct($product);
            $primaryCode = $ordered->first()?->productProvider?->code ?? '-';
            $primaryPreferred = (bool) ($ordered->first()?->is_preferred ?? false);
            $primaryWarning = '';
            if ($primaryPreferred && strtolower((string) $primaryCode) === ProductProvider::CODE_VIP) {
                $primaryWarning = ' *** VIP is_preferred=true — overrides priority ***';
            }

            $rows[] = [
                $product->id,
                $product->sku_code,
                Str::limit($product->name, 40),
                $product->category?->slug ?? '-',
                $product->provider?->name ?? '-',
                $classification['group_key'],
                $classification['sibling_count'],
                $classification['digi_active'] ? 'yes' : 'no',
                $classification['vip_active'] ? 'yes' : 'no',
                $classification['bucket'],
                $primaryCode.$primaryWarning,
            ];
        }

        $duplicateWarnings = $this->detectDuplicateLogicalProducts($products);

        $this->table(
            ['product_id', 'sku', 'name', 'category', 'brand', 'logical_key', 'siblings', 'digi', 'vip', 'class', 'routing_primary'],
            $rows
        );

        $this->newLine();
        $this->info('=== SUMMARY ===');
        $this->table(
            ['Classification', 'Count'],
            collect($counts)->map(fn ($c, $k) => [$k, $c])->values()->all()
        );
        $this->line('Duplicate logical product warnings: '.count($duplicateWarnings));
        $this->line('Invalid SKU warnings (active but empty provider_sku): '.count($invalidSkuWarnings));

        if ($duplicateWarnings !== []) {
            $this->newLine();
            $this->warn('=== DUPLICATE LOGICAL PRODUCT WARNINGS ===');
            foreach (array_slice($duplicateWarnings, 0, 50) as $w) {
                $this->line($w);
            }
            if (count($duplicateWarnings) > 50) {
                $this->line('... and '.(count($duplicateWarnings) - 50).' more');
            }
        }

        if ($invalidSkuWarnings !== []) {
            $this->newLine();
            $this->warn('=== INVALID SKU WARNINGS ===');
            foreach (array_slice($invalidSkuWarnings, 0, 50) as $w) {
                $this->line($w);
            }
            if (count($invalidSkuWarnings) > 50) {
                $this->line('... and '.(count($invalidSkuWarnings) - 50).' more');
            }
        }

        return self::SUCCESS;
    }

    /**
     * @return array{bucket: string, group_key: string, sibling_count: int, digi_active: bool, vip_active: bool, invalid_skus: list<string>}
     */
    protected function classifyLogicalGroup(Product $product, ?int $digiId, ?int $vipId): array
    {
        $routing = app(ProductRoutingService::class);
        $siblingIds = $routing->logicalSiblingProductIdsPublic($product);
        $groupKey = LogicalProductKey::groupKey($product);

        $skus = ProductProviderSku::query()
            ->whereIn('product_id', $siblingIds)
            ->where('is_active', true)
            ->get();

        $digiActive = false;
        $vipActive = false;
        $invalidSkus = [];

        foreach ($skus as $sku) {
            if ($sku->is_active && trim((string) $sku->provider_sku) === '') {
                $invalidSkus[] = sprintf(
                    'product_id=%d product_provider_id=%d has is_active=true but empty provider_sku',
                    $sku->product_id,
                    $sku->product_provider_id
                );
            }
            if ((int) $sku->product_provider_id === (int) $digiId && $sku->is_active && trim((string) $sku->provider_sku) !== '') {
                $digiActive = true;
            }
            if ((int) $sku->product_provider_id === (int) $vipId && $sku->is_active && trim((string) $sku->provider_sku) !== '') {
                $vipActive = true;
            }
        }

        $bucket = match (true) {
            $digiActive && $vipActive => 'Both',
            $digiActive => 'Digi-only',
            $vipActive => 'VIP-only',
            default => 'Tidak ada mapping aktif',
        };

        return [
            'bucket' => $bucket,
            'group_key' => $groupKey,
            'sibling_count' => count($siblingIds),
            'digi_active' => $digiActive,
            'vip_active' => $vipActive,
            'invalid_skus' => $invalidSkus,
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Product>  $products
     * @return list<string>
     */
    protected function detectDuplicateLogicalProducts($products): array
    {
        $warnings = [];
        $byOperator = $products->groupBy(fn (Product $p) => (int) ($p->provider_id ?? 0));

        foreach ($byOperator as $operatorId => $group) {
            if ($operatorId <= 0 || $group->count() < 2) {
                continue;
            }

            $items = $group->values()->all();
            $count = count($items);
            for ($i = 0; $i < $count; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    $a = $items[$i];
                    $b = $items[$j];
                    $keyA = LogicalProductKey::groupKey($a);
                    $keyB = LogicalProductKey::groupKey($b);
                    if ($keyA === $keyB) {
                        continue;
                    }
                    if (!$this->namesLookSimilar($a->name, $b->name)) {
                        continue;
                    }
                    $warnings[] = sprintf(
                        'operator_id=%d | #%d "%s" (key=%s) vs #%d "%s" (key=%s) — kemungkinan duplicate logical product',
                        $operatorId,
                        $a->id,
                        $a->name,
                        $keyA,
                        $b->id,
                        $b->name,
                        $keyB
                    );
                }
            }
        }

        return $warnings;
    }

    protected function namesLookSimilar(string $nameA, string $nameB): bool
    {
        $normA = LogicalProductKey::normalizeName($nameA);
        $normB = LogicalProductKey::normalizeName($nameB);
        if ($normA === $normB) {
            return true;
        }

        $denomA = LogicalProductKey::extractDenomination($nameA) ?? $this->extractKDenomination($nameA);
        $denomB = LogicalProductKey::extractDenomination($nameB) ?? $this->extractKDenomination($nameB);
        if ($denomA !== null && $denomB !== null && $denomA === $denomB) {
            return true;
        }

        similar_text($normA, $normB, $pct);

        return $pct >= 75.0;
    }

    protected function extractKDenomination(string $name): ?int
    {
        if (preg_match('/\b(\d+)\s*k\b/i', $name, $m)) {
            return (int) $m[1] * 1000;
        }

        return null;
    }
}
