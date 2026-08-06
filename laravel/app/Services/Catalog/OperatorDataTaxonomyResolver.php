<?php

namespace App\Services\Catalog;

/**
 * Resolves the correct Paket Data taxonomy service for an operator brand.
 */
class OperatorDataTaxonomyResolver
{
    public function __construct(
        protected TelkomselDataTaxonomyService $telkomsel,
        protected XlDataTaxonomyService $xl,
        protected IndosatDataTaxonomyService $indosat,
        protected TriDataTaxonomyService $tri,
        protected SmartfrenDataTaxonomyService $smartfren,
        protected AxisDataTaxonomyService $axis,
        protected ByuDataTaxonomyService $byu,
    ) {}

    public function forBrand(?string $brand): ?OperatorDataTaxonomyService
    {
        if ($this->telkomsel->isOperatorBrand($brand)) {
            return $this->telkomsel;
        }
        if ($this->xl->isOperatorBrand($brand)) {
            return $this->xl;
        }
        if ($this->indosat->isOperatorBrand($brand)) {
            return $this->indosat;
        }
        if ($this->tri->isOperatorBrand($brand)) {
            return $this->tri;
        }
        if ($this->smartfren->isOperatorBrand($brand)) {
            return $this->smartfren;
        }
        if ($this->axis->isOperatorBrand($brand)) {
            return $this->axis;
        }
        if ($this->byu->isOperatorBrand($brand)) {
            return $this->byu;
        }

        return null;
    }

    /**
     * Shared meta helpers (quota/validity) — any operator service works.
     */
    public function meta(): OperatorDataTaxonomyService
    {
        return $this->telkomsel;
    }
}
