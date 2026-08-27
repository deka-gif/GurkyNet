<?php

namespace App\Services\Pricing;

use App\Models\Product;
use App\Models\ProductPrice;
use App\Services\PricingService;

/**
 * FR-DIFF-03 — Agent margin calculator (DISPLAY-ONLY).
 * margin_nominal = sell_price(agent_level) - provider_cost (base_price).
 * Does NOT mutate checkout / products.sell_price / live PricingService path.
 */
class AgentMarginCalculatorService
{
    public const AGENT_LEVELS = ['reguler', 'gold', 'platinum', 'end_user'];

    public function __construct(
        protected PricingService $pricingService
    ) {}

    /**
     * @return array{
     *   product_id:int,
     *   product_name:string,
     *   sku_code:?string,
     *   provider:?string,
     *   provider_cost:float,
     *   default_margin_setting:float,
     *   levels:array<int,array{agent_level:string,sell_price:float|null,margin_nominal:float|null,source:string}>
     * }
     */
    public function calculateForProduct(Product $product): array
    {
        $providerCost = (float) $product->base_price;
        $fallbackSell = (float) $product->sell_price;
        $defaultMargin = $this->pricingService->defaultMargin();

        $currentPrices = ProductPrice::query()
            ->where('product_id', $product->id)
            ->where('is_current', true)
            ->get()
            ->keyBy(fn (ProductPrice $p) => strtolower((string) $p->agent_level));

        $levels = [];
        foreach (self::AGENT_LEVELS as $level) {
            $row = $currentPrices->get($level);
            if ($row) {
                $sell = (float) $row->sell_price;
                $source = 'product_prices';
            } elseif ($fallbackSell > 0) {
                // Display fallback only — not a live pricing change.
                $sell = $fallbackSell;
                $source = 'products.sell_price_fallback';
            } else {
                $sell = null;
                $source = 'missing';
            }

            $margin = $sell === null ? null : round($sell - $providerCost, 2);

            $levels[] = [
                'agent_level' => $level,
                'sell_price' => $sell,
                'margin_nominal' => $margin,
                'source' => $source,
            ];
        }

        return [
            'product_id' => (int) $product->id,
            'product_name' => (string) $product->name,
            'sku_code' => $product->sku_code,
            'provider' => $product->productProvider?->name ?? $product->provider?->name,
            'provider_code' => $product->productProvider?->code,
            'provider_cost' => $providerCost,
            'default_margin_setting' => $defaultMargin,
            'levels' => $levels,
            'display_only' => true,
            'note' => 'FR-DIFF-03 Sprint 15 — display-only; checkout tetap memakai PricingService existing.',
        ];
    }

    /**
     * Upsert current product_prices row for an agent_level (Ops config). Additive.
     */
    public function upsertLevelPrice(Product $product, string $agentLevel, float $sellPrice): ProductPrice
    {
        $agentLevel = strtolower(trim($agentLevel));
        if (! in_array($agentLevel, self::AGENT_LEVELS, true)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'agent_level' => ['agent_level tidak valid.'],
            ]);
        }

        ProductPrice::query()
            ->where('product_id', $product->id)
            ->where('agent_level', $agentLevel)
            ->where('is_current', true)
            ->update(['is_current' => false]);

        return ProductPrice::query()->create([
            'product_id' => $product->id,
            'agent_level' => $agentLevel,
            'sell_price' => $sellPrice,
            'effective_from' => now(),
            'is_current' => true,
        ]);
    }
}
