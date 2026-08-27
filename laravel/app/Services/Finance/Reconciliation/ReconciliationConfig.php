<?php

namespace App\Services\Finance\Reconciliation;

use App\Models\SystemSetting;

/**
 * SRS 18.2 / 19 — threshold configurable by Finance/Owner; default Rp50.000.
 */
class ReconciliationConfig
{
    public const SETTING_KEY = 'finance_recon_threshold_amount';

    public function threshold(): float
    {
        $fromDb = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        if ($fromDb !== null && $fromDb !== '' && is_numeric($fromDb)) {
            return (float) $fromDb;
        }

        return (float) config('finance.recon_threshold_amount', 50000);
    }

    public function exceedsThreshold(float $varianceAbs): bool
    {
        return $varianceAbs > $this->threshold();
    }
}
