<?php

namespace App\Services\Catalog;

/**
 * Telkomsel Paket Data taxonomy — master template for other operators.
 */
class TelkomselDataTaxonomyService extends OperatorDataTaxonomyService
{
    protected function configKey(): string
    {
        return 'telkomsel_data';
    }

    public function isTelkomselBrand(?string $brand): bool
    {
        return $this->isOperatorBrand($brand);
    }
}
