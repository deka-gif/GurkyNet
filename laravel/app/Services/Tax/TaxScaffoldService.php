<?php

namespace App\Services\Tax;

use App\Models\TaxSetting;

/**
 * Sprint 18 — PPN scaffold only (Bagian 22). Never invents a rate or computes PPN.
 */
class TaxScaffoldService
{
    /**
     * @return array{pkp_enabled:bool,ppn_rate:?float,ppn_amount:null,tax_metadata:array,calculation_applied:bool}
     */
    public function reportScaffold(): array
    {
        $settings = TaxSetting::current();
        $rate = $settings->ppn_rate !== null ? (float) $settings->ppn_rate : null;
        if ($rate === null) {
            $cfg = config('tax.ppn_rate');
            $rate = ($cfg === null || $cfg === '') ? null : (float) $cfg;
        }

        return [
            'pkp_enabled' => (bool) $settings->pkp_enabled || (bool) config('tax.pkp_enabled', false),
            'ppn_rate' => $rate,
            'ppn_amount' => null, // never computed in Sprint 18
            'tax_metadata' => [
                'scaffold' => true,
                'legal_note' => 'PPN calculation deferred until PKP/rate decided by tax consultant.',
            ],
            'calculation_applied' => false,
        ];
    }
}
