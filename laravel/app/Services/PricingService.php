<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Setting;

class PricingService
{
    /**
     * Calculate selling price and margin details.
     */
    public function calculate(float $basePrice, float $margin = 1500, float $adminFee = 0): array
    {
        $sellPrice = $basePrice + $margin + $adminFee;

        return [
            'base_price' => $basePrice,
            'margin' => $margin,
            'admin_fee' => $adminFee,
            'sell_price' => $sellPrice,
        ];
    }

    /**
     * Calculate pricing specifically for a product model.
     * Master product sell_price / base_price are authoritative; fallback margin comes from settings.
     */
    public function calculateForProduct(Product $product): array
    {
        $basePrice = (float) $product->base_price;
        $adminFee = (float) $product->admin_fee;

        if ($product->sell_price > 0) {
            $sellPrice = (float) $product->sell_price;
            $margin = $sellPrice - $basePrice - $adminFee;
        } else {
            $margin = $this->defaultMargin();
            $sellPrice = $basePrice + $margin + $adminFee;
        }

        return [
            'base_price' => $basePrice,
            'margin' => $margin,
            'admin_fee' => $adminFee,
            'sell_price' => $sellPrice,
            'provider_cost' => $basePrice,
            'selling_price' => $sellPrice,
        ];
    }

    /**
     * Default margin from Operations pricing settings.
     */
    public function defaultMargin(): float
    {
        return (float) (Setting::where('key', 'default_margin')->value('value') ?? 1500);
    }
}
