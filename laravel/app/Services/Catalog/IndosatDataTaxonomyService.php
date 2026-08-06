<?php

namespace App\Services\Catalog;

/**
 * Indosat Paket Data taxonomy — same master pattern as Telkomsel / XL.
 */
class IndosatDataTaxonomyService extends OperatorDataTaxonomyService
{
    protected function configKey(): string
    {
        return 'indosat_data';
    }

    public function isIndosatBrand(?string $brand): bool
    {
        return $this->isOperatorBrand($brand);
    }
}
