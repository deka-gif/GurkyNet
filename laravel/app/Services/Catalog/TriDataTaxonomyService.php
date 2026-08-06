<?php

namespace App\Services\Catalog;

use Illuminate\Support\Str;

/**
 * Tri (3) Paket Data taxonomy — same master pattern as Telkomsel / XL / Indosat.
 */
class TriDataTaxonomyService extends OperatorDataTaxonomyService
{
    protected function configKey(): string
    {
        return 'tri_data';
    }

    public function isOperatorBrand(?string $brand): bool
    {
        $key = Str::lower(preg_replace('/[^a-z0-9]+/i', '', (string) $brand) ?? '');
        if ($key === '3') {
            return true;
        }

        return parent::isOperatorBrand($brand);
    }

    public function isTriBrand(?string $brand): bool
    {
        return $this->isOperatorBrand($brand);
    }
}
