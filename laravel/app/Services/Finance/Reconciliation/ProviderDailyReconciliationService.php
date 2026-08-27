<?php

namespace App\Services\Finance\Reconciliation;

use App\Enums\TransactionStatus;
use App\Models\GatewayReconciliationItem;
use App\Models\ProductProvider;
use App\Models\ReconciliationIncident;
use App\Models\Transaction;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\Artisan;

/**
 * SRS 18.1 / 15.6 — daily Digiflazz & VIPayment balance vs success TX totals.
 */
class ProviderDailyReconciliationService
{
    public function __construct(
        protected ReconciliationIncidentService $incidents,
        protected ReconciliationConfig $config
    ) {}

    /**
     * @return array{items:int,incidents:list<int>}
     */
    public function run(?\DateTimeInterface $date = null): array
    {
        $day = ($date ?? now())->format('Y-m-d');
        // Refresh cached balances via existing command (no adapter rewrite).
        // Skip live sync in PHPUnit so tests control balance fixtures.
        if (! app()->runningUnitTests()) {
            try {
                Artisan::call('integration:sync-balances');
            } catch (\Throwable $e) {
                // Continue with last known balances.
            }
        }

        $incidentIds = [];
        $items = 0;
        $threshold = $this->config->threshold();

        foreach ([ProductProvider::CODE_DIGIFLAZZ, ProductProvider::CODE_VIP] as $code) {
            $provider = ProductProvider::findByCode($code);
            if (! $provider) {
                continue;
            }

            $providerBalance = $provider->balance !== null ? (float) $provider->balance : 0.0;
            $successTotal = (float) Transaction::query()
                ->whereDate('updated_at', $day)
                ->where('status', TransactionStatus::SUCCESS->value)
                ->where(function ($q) use ($code) {
                    $q->where('notes', 'like', '%'.$code.'%')
                        ->orWhereHas('items', function ($iq) use ($code) {
                            $iq->where('custom_metadata', 'like', '%'.$code.'%');
                        });
                })
                ->sum('total_payment');

            // Comparison record: provider deposit balance vs day's success volume (detection).
            // Variance = |provider_balance_delta_proxy|; we store provider balance as external,
            // internal success sum as internal — Finance reviews absolute gap vs threshold.
            $variance = round($providerBalance - $successTotal, 2);
            $abs = abs($variance);

            $row = GatewayReconciliationItem::query()->updateOrCreate(
                [
                    'recon_date' => $day,
                    'source' => $code,
                    'external_reference' => 'provider-balance-'.$day,
                ],
                [
                    'external_amount' => $providerBalance,
                    'internal_amount' => $successTotal,
                    'variance' => $variance,
                    'match_status' => abs($variance) < 0.01 ? 'matched' : 'unmatched',
                    'internal_type' => 'daily_success_total',
                    'meta' => [
                        'provider_id' => $provider->id,
                        'provider_name' => $provider->name,
                    ],
                ]
            );
            $items++;

            if ($this->config->exceedsThreshold($abs)) {
                $incident = $this->incidents->openOrRefresh([
                    'fingerprint' => 'provider_h2h:'.$code.':'.$day,
                    'type' => ReconciliationIncident::TYPE_PROVIDER_H2H,
                    'source' => $code,
                    'expected_amount' => $successTotal,
                    'actual_amount' => $providerBalance,
                    'variance' => $variance,
                    'threshold' => $threshold,
                    'freeze_withdraw' => true,
                    'restrict_purchase' => false,
                    'system_wide_freeze' => true,
                    'notes' => 'Provider H2H daily recon variance > threshold (SRS 18.1 / 15.6)',
                    'meta' => ['gateway_item_id' => $row->id, 'recon_date' => $day],
                ]);
                $row->update(['reconciliation_incident_id' => $incident->id, 'match_status' => 'discrepancy']);
                $incidentIds[] = $incident->id;
            }
        }

        FinanceAudit::log(null, 'RECON_PROVIDER_DAILY_RUN', [
            'date' => $day,
            'items' => $items,
            'incidents' => count($incidentIds),
        ]);

        return ['items' => $items, 'incidents' => $incidentIds];
    }
}
