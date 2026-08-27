<?php

namespace App\Services\Finance\Reconciliation;

use App\Enums\TransactionStatus;
use App\Jobs\ProcessMidtransCallback;
use App\Models\GatewayReconciliationItem;
use App\Models\MidtransTransaction;
use App\Models\ReconciliationIncident;
use App\Models\Transaction;
use App\Models\WalletMutation;
use App\Services\MidtransService;
use App\Support\Finance\FinanceAudit;
use Illuminate\Support\Facades\Log;

/**
 * SRS 18.1 / 16.4 — Midtrans daily settlement compare + pending poll.
 */
class MidtransReconciliationService
{
    public function __construct(
        protected MidtransService $midtrans,
        protected ReconciliationIncidentService $incidents,
        protected ReconciliationConfig $config
    ) {}

    /**
     * Daily: internal successful Midtrans topups vs Midtrans settlement statuses.
     *
     * @return array{items:int,incidents:list<int>}
     */
    public function runDailySettlement(?\DateTimeInterface $date = null): array
    {
        $day = ($date ?? now())->format('Y-m-d');
        $threshold = $this->config->threshold();
        $incidentIds = [];
        $items = 0;

        $rows = MidtransTransaction::query()
            ->whereDate('updated_at', $day)
            ->orWhereDate('created_at', $day)
            ->get();

        $internalSettled = 0.0;
        $externalSettled = 0.0;

        foreach ($rows as $mt) {
            $status = strtolower((string) $mt->transaction_status);
            $amount = (float) $mt->gross_amount;
            $isSettledExternal = in_array($status, ['settlement', 'capture', 'success'], true);

            $tx = $mt->transaction;
            $internalCredited = false;
            if ($tx) {
                $internalCredited = WalletMutation::query()
                    ->where('reference_id', (string) $tx->id)
                    ->where('type', WalletMutation::TYPE_TOPUP)
                    ->exists()
                    || TransactionStatus::tryFrom((string) $tx->status) === TransactionStatus::SUCCESS
                    || strtolower((string) $tx->status) === 'success';
            }

            if ($isSettledExternal) {
                $externalSettled += $amount;
            }
            if ($internalCredited) {
                $internalSettled += $amount;
            }

            $variance = round(($isSettledExternal ? $amount : 0) - ($internalCredited ? $amount : 0), 2);
            $match = abs($variance) < 0.01 ? 'matched' : 'unmatched';

            GatewayReconciliationItem::query()->updateOrCreate(
                [
                    'recon_date' => $day,
                    'source' => 'midtrans',
                    'external_reference' => (string) $mt->order_id,
                ],
                [
                    'external_amount' => $isSettledExternal ? $amount : 0,
                    'internal_amount' => $internalCredited ? $amount : 0,
                    'variance' => $variance,
                    'match_status' => $match,
                    'internal_type' => 'midtrans_transaction',
                    'internal_id' => $mt->id,
                    'meta' => [
                        'transaction_status' => $mt->transaction_status,
                        'transaction_id' => $mt->transaction_id,
                    ],
                ]
            );
            $items++;
        }

        $dayVariance = round($externalSettled - $internalSettled, 2);
        if ($this->config->exceedsThreshold(abs($dayVariance))) {
            $incident = $this->incidents->openOrRefresh([
                'fingerprint' => 'midtrans_settlement:'.$day,
                'type' => ReconciliationIncident::TYPE_MIDTRANS_SETTLEMENT,
                'source' => 'midtrans',
                'expected_amount' => $internalSettled,
                'actual_amount' => $externalSettled,
                'variance' => $dayVariance,
                'threshold' => $threshold,
                'freeze_withdraw' => true,
                'restrict_purchase' => false,
                'system_wide_freeze' => true,
                'notes' => 'Midtrans daily settlement vs internal topup mismatch (SRS 16.4 / 18.1)',
                'meta' => ['recon_date' => $day],
            ]);
            $incidentIds[] = $incident->id;
        }

        FinanceAudit::log(null, 'RECON_MIDTRANS_DAILY_RUN', [
            'date' => $day,
            'items' => $items,
            'external_settled' => $externalSettled,
            'internal_settled' => $internalSettled,
        ]);

        return ['items' => $items, 'incidents' => $incidentIds];
    }

    /**
     * SRS 16.4 — poll pending Midtrans deposits older than 5 minutes.
     * Dispatches existing ProcessMidtransCallback (idempotent credit).
     *
     * @return array{polled:int,dispatched:int}
     */
    public function pollPendingDeposits(): array
    {
        $age = (int) config('finance.midtrans_pending_age_minutes', 5);
        $polled = 0;
        $dispatched = 0;

        $pending = MidtransTransaction::query()
            ->where(function ($q) {
                $q->whereNull('transaction_status')
                    ->orWhereNotIn('transaction_status', [
                        'settlement', 'capture', 'success', 'expire', 'cancel', 'failure', 'failed', 'deny',
                    ]);
            })
            ->where('created_at', '<=', now()->subMinutes($age))
            ->orderBy('id')
            ->limit(100)
            ->get();

        foreach ($pending as $mt) {
            $polled++;
            if (! $this->midtrans->isConfigured()) {
                break;
            }
            try {
                $status = $this->midtrans->checkStatus((string) $mt->order_id);
                $txStatus = $status['transaction_status'] ?? $status['status'] ?? null;
                if (! $txStatus) {
                    continue;
                }

                $payload = array_merge(is_array($status) ? $status : [], [
                    'order_id' => $mt->order_id,
                    'transaction_status' => $txStatus,
                    'gross_amount' => $status['gross_amount'] ?? $mt->gross_amount,
                    'payment_type' => $status['payment_type'] ?? $mt->payment_type,
                ]);

                // Reuse webhook processor — duplicate-safe credit.
                ProcessMidtransCallback::dispatchSync($payload);
                $dispatched++;
            } catch (\Throwable $e) {
                Log::warning('Midtrans pending poll failed', [
                    'order_id' => $mt->order_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        FinanceAudit::log(null, 'RECON_MIDTRANS_PENDING_POLL', [
            'polled' => $polled,
            'dispatched' => $dispatched,
        ]);

        return compact('polled', 'dispatched');
    }
}
