<?php

namespace App\Services;

use App\Models\Product;

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
     */
    public function calculateForProduct(Product $product): array
    {
        $basePrice = (float) $product->base_price;
        $adminFee = (float) $product->admin_fee;
        
        // If sell_price is already in DB, the margin is sell_price - base_price - admin_fee
        // Otherwise, default margin to 1500
        if ($product->sell_price > 0) {
            $sellPrice = (float) $product->sell_price;
            $margin = $sellPrice - $basePrice - $adminFee;
        } else {
            $margin = 1500.00;
            $sellPrice = $basePrice + $margin + $adminFee;
        }

        return [
            'base_price' => $basePrice,
            'margin' => $margin,
            'admin_fee' => $adminFee,
            'sell_price' => $sellPrice,
        ];
    }
}
