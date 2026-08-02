<?php

namespace App\Actions\Product;

use App\Services\PricingService;
use App\Models\Product;

class PricingAction
{
    protected PricingService $pricingService;

    public function __construct(PricingService $pricingService)
    {
        $this->pricingService = $pricingService;
    }

    public function execute(Product $product): array
    {
        return $this->pricingService->calculateForProduct($product);
    }

    public function calculate(float $basePrice, float $margin, float $adminFee): array
    {
        return $this->pricingService->calculate($basePrice, $margin, $adminFee);
    }
}
