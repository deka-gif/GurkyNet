<?php

namespace App\Actions\Product;

use App\Services\AvailabilityService;
use App\Models\Product;

class AvailabilityAction
{
    protected AvailabilityService $availabilityService;

    public function __construct(AvailabilityService $availabilityService)
    {
        $this->availabilityService = $availabilityService;
    }

    public function execute(Product $product): string
    {
        return $this->availabilityService->getStatus($product);
    }

    public function isAvailable(Product $product): bool
    {
        return $this->availabilityService->isAvailable($product);
    }
}
