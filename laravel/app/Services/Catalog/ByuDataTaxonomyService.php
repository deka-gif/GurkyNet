<?php

namespace App\Services\Catalog;

/**
 * by.U Paket Data taxonomy — same master pattern as Telkomsel and other operators.
 */
class ByuDataTaxonomyService extends OperatorDataTaxonomyService
{
    protected function configKey(): string
    {
        return 'byu_data';
    }

    public function isByuBrand(?string $brand): bool
    {
        return $this->isOperatorBrand($brand);
    }
}
