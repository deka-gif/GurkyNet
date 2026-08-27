<?php

namespace App\Console\Commands;

use App\Services\Referral\ReferralCommissionService;
use Illuminate\Console\Command;

/** SRS 31.4 step 6 — daily release of pending referral commissions. */
class ReleaseReferralCommissionsCommand extends Command
{
    protected $signature = 'referral:release-commissions';

    protected $description = 'Release due pending referral commissions (FR-REF-06)';

    public function handle(ReferralCommissionService $service): int
    {
        $stats = $service->releaseDue();
        $this->info('Referral release: '.json_encode($stats));

        return self::SUCCESS;
    }
}
