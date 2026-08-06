<?php

namespace App\Services\Catalog;

/**
 * AXIS Paket Data taxonomy — same master pattern as Telkomsel and other operators.
 */
class AxisDataTaxonomyService extends OperatorDataTaxonomyService
{
    protected function configKey(): string
    {
        return 'axis_data';
    }

    public function isAxisBrand(?string $brand): bool
    {
        return $this->isOperatorBrand($brand);
    }
}
