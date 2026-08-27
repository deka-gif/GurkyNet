<?php

namespace App\Services\PartnerApi;

use App\Models\ApiPartner;
use App\Models\ApiRequestLog;
use App\Models\PartnerProductPrice;
use App\Models\Product;
use App\Services\AvailabilityService;
use Illuminate\Support\Collection;

/**
 * FR-API-04 — price/stock inquiry with partner_tier pricing (isolated from agent product_prices).
 */
class PartnerPricingService
{
    public function __construct(
        protected AvailabilityService $availability
    ) {}

    /**
     * @return list<array{sku_code:string,name:string,sell_price:float,admin_fee:float,stock_status:string}>
     */
    public function inquire(ApiPartner $partner, ?string $skuCode = null): array
    {
        $query = Product::query()->with(['category', 'provider']);
        if ($skuCode) {
            $query->where('sku_code', $skuCode);
        } else {
            $query->limit(200);
        }

        $products = $query->get();
        $out = [];

        foreach ($products as $product) {
            $status = $this->availability->getStatus($product);
            if ($status === 'inactive') {
                if ($skuCode) {
                    continue; // single SKU inactive → empty (caller may 404)
                }
                continue;
            }

            $price = $this->resolvePartnerSellPrice($partner, $product);
            $out[] = [
                'sku_code' => $product->sku_code,
                'name' => $product->name,
                'sell_price' => $price,
                'admin_fee' => (float) ($product->admin_fee ?? 0),
                'stock_status' => $status,
                'partner_tier' => $partner->tier,
            ];
        }

        return $out;
    }

    public function resolvePartnerSellPrice(ApiPartner $partner, Product $product): float
    {
        $row = PartnerProductPrice::query()
            ->where('product_id', $product->id)
            ->where('partner_tier', $partner->tier)
            ->where('is_current', true)
            ->orderByDesc('effective_from')
            ->first();

        if ($row) {
            return (float) $row->sell_price;
        }

        // Fallback: product sell_price (not agent product_prices table)
        return (float) $product->sell_price;
    }

    public function upsertPrice(int $productId, string $tier, float $sellPrice, ?int $updatedBy = null): PartnerProductPrice
    {
        PartnerProductPrice::query()
            ->where('product_id', $productId)
            ->where('partner_tier', $tier)
            ->where('is_current', true)
            ->update(['is_current' => false]);

        return PartnerProductPrice::create([
            'product_id' => $productId,
            'partner_tier' => $tier,
            'sell_price' => $sellPrice,
            'is_current' => true,
            'effective_from' => now(),
            'updated_by' => $updatedBy,
        ]);
    }
}
