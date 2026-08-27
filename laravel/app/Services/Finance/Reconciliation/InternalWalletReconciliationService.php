<?php

namespace App\Services\Finance\Reconciliation;

use App\Models\Wallet;
use App\Support\Finance\FinanceAudit;

/**
 * SRS 18.1 — hourly internal wallet balance vs Σ wallet_mutations.
 * Detection only — never auto-rewrites balance.
 */
class InternalWalletReconciliationService
{
    public function __construct(
        protected ReconciliationIncidentService $incidents,
        protected ReconciliationConfig $config
    ) {}

    /**
     * @return array{checked:int,mismatches:int,incidents:list<int>}
     */
    public function run(): array
    {
        $threshold = $this->config->threshold();
        $checked = 0;
        $mismatches = 0;
        $ids = [];

        Wallet::query()->orderBy('id')->chunkById(200, function ($wallets) use ($threshold, &$checked, &$mismatches, &$ids) {
            foreach ($wallets as $wallet) {
                $checked++;
                $expected = $this->incidents->expectedBalanceFromMutations((int) $wallet->id);
                $actual = round((float) $wallet->balance, 2);
                $variance = round($actual - $expected, 2);

                if (abs($variance) < 0.01) {
                    continue;
                }

                $mismatches++;
                $over = $this->config->exceedsThreshold(abs($variance));

                // Locked rule: internal wallet variance → withdraw freeze for account;
                // purchase restricted only for this affected user (wallet root cause).
                $incident = $this->incidents->openOrRefresh([
                    'fingerprint' => 'internal_wallet:'.$wallet->id,
                    'type' => \App\Models\ReconciliationIncident::TYPE_INTERNAL_WALLET,
                    'source' => 'wallet',
                    'user_id' => $wallet->user_id,
                    'wallet_id' => $wallet->id,
                    'expected_amount' => $expected,
                    'actual_amount' => $actual,
                    'variance' => $variance,
                    'threshold' => $threshold,
                    'freeze_withdraw' => true,
                    'restrict_purchase' => true,
                    'system_wide_freeze' => false,
                    'notes' => 'Internal wallet ledger mismatch (SRS 18.1)',
                    'meta' => ['over_threshold' => $over],
                ]);
                $ids[] = $incident->id;
            }
        });

        FinanceAudit::log(null, 'RECON_INTERNAL_WALLET_RUN', [
            'checked' => $checked,
            'mismatches' => $mismatches,
        ]);

        return [
            'checked' => $checked,
            'mismatches' => $mismatches,
            'incidents' => $ids,
        ];
    }
}
