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
     * Check Midtrans status for one order and apply via ProcessMidtransCallback
     * (same path as webhook / pending poll — lock + idempotent, no new Snap token).
     * FR-TOPUP-UX-02 / SRS 16.4.
     *
     * @return array{ok:bool,status:?string,error:?string}
     */
    public function reconcileOrder(string $orderId): array
    {
        if (! $this->midtrans->isConfigured()) {
            return ['ok' => false, 'status' => null, 'error' => 'not_configured'];
        }

        try {
            $status = $this->midtrans->checkStatus($orderId);
            $txStatus = $status['transaction_status'] ?? $status['status'] ?? null;
            if (! $txStatus) {
                return ['ok' => false, 'status' => null, 'error' => 'empty_status'];
            }

            $mt = MidtransTransaction::query()->where('order_id', $orderId)->first();
            $payload = array_merge(is_array($status) ? $status : [], [
                'order_id' => $orderId,
                'transaction_status' => $txStatus,
                'gross_amount' => $status['gross_amount'] ?? $mt?->gross_amount,
                'payment_type' => $status['payment_type'] ?? $mt?->payment_type,
            ]);

            ProcessMidtransCallback::dispatchSync($payload);

            return ['ok' => true, 'status' => (string) $txStatus, 'error' => null];
        } catch (\Throwable $e) {
            Log::warning('Midtrans reconcileOrder failed', [
                'order_id' => $orderId,
                'error' => $e->getMessage(),
            ]);

            return ['ok' => false, 'status' => null, 'error' => $e->getMessage()];
        }
    }

    /**
     * SRS 16.4 — poll Midtrans deposits older than 5 minutes.
     * Uses existing reconcileOrder → ProcessMidtransCallback (idempotent credit).
     *
     * Includes:
     * - open Midtrans statuses (pending/challenge/…)
     * - stuck settlements: MT settlement/capture but local not success AND no topup mutation
     *   (production hole: MT row updated before credit crashed → previously excluded forever)
     *
     * @return array{polled:int,dispatched:int}
     */
    public function pollPendingDeposits(): array
    {
        $age = (int) config('finance.midtrans_pending_age_minutes', 5);
        $cutoff = now()->subMinutes($age);
        $polled = 0;
        $dispatched = 0;
        $seen = [];

        $candidates = $this->midtransPollCandidates($cutoff);

        foreach ($candidates as $mt) {
            $orderId = (string) $mt->order_id;
            if ($orderId === '' || isset($seen[$orderId])) {
                continue;
            }
            $seen[$orderId] = true;

            $polled++;
            if (! $this->midtrans->isConfigured()) {
                break;
            }
            $result = $this->reconcileOrder($orderId);
            if ($result['ok']) {
                $dispatched++;
            }
        }

        FinanceAudit::log(null, 'RECON_MIDTRANS_PENDING_POLL', [
            'polled' => $polled,
            'dispatched' => $dispatched,
        ]);

        return compact('polled', 'dispatched');
    }

    /**
     * @return \Illuminate\Support\Collection<int, MidtransTransaction>
     */
    protected function midtransPollCandidates(\DateTimeInterface $cutoff)
    {
        $open = MidtransTransaction::query()
            ->where(function ($q) {
                $q->whereNull('transaction_status')
                    ->orWhereNotIn('transaction_status', [
                        'settlement', 'capture', 'success', 'expire', 'cancel', 'failure', 'failed', 'deny',
                    ]);
            })
            ->where('created_at', '<=', $cutoff)
            ->orderBy('id')
            ->limit(100)
            ->get();

        // Stuck settlement/capture: local unpaid + no topup mutation yet.
        // Eligibility is applied in SQL BEFORE limit(100) so newer stuck rows are not
        // hidden behind historical settlement/capture/success rows that already credited.
        // No age cutoff — MT is already final; delaying only prolongs missing credit.
        $settledStuck = MidtransTransaction::query()
            ->whereIn('transaction_status', ['settlement', 'capture', 'success'])
            ->whereHas('transaction', function ($q) {
                $q->whereRaw('LOWER(status) NOT IN (?, ?)', ['success', 'sukses'])
                    ->whereNotExists(function ($sub) {
                        $sub->selectRaw('1')
                            ->from('wallet_mutations')
                            ->where('wallet_mutations.type', WalletMutation::TYPE_TOPUP)
                            // reference_id is stored as string of transactions.id
                            ->whereColumn('wallet_mutations.reference_id', 'transactions.id');
                    });
            })
            ->orderBy('id')
            ->limit(100)
            ->get();

        // Each branch already capped at 100; do not re-take(100) after concat or open
        // pending rows could hide eligible stuck settlements.
        return $open->concat($settledStuck)->unique('id')->sortBy('id')->values();
    }
}
