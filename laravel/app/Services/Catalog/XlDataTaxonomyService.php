<?php

namespace App\Services\Catalog;

/**
 * XL Paket Data taxonomy — same master pattern as Telkomsel.
 */
class XlDataTaxonomyService extends OperatorDataTaxonomyService
{
    protected function configKey(): string
    {
        return 'xl_data';
    }

    public function isXlBrand(?string $brand): bool
    {
        return $this->isOperatorBrand($brand);
    }
}
