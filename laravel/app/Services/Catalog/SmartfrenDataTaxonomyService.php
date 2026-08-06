<?php

namespace App\Services\Catalog;

/**
 * Smartfren Paket Data taxonomy — same master pattern as Telkomsel / XL / Indosat / Tri.
 */
class SmartfrenDataTaxonomyService extends OperatorDataTaxonomyService
{
    protected function configKey(): string
    {
        return 'smartfren_data';
    }

    public function isSmartfrenBrand(?string $brand): bool
    {
        return $this->isOperatorBrand($brand);
    }
}
