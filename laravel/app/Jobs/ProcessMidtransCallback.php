<?php

namespace App\Jobs;

use App\Enums\TransactionStatus;
use App\Models\MidtransTransaction;
use App\Models\PaymentHistory;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Finance\Reconciliation\ReconciliationIncidentService;
use App\Services\Wallet\WalletLedgerService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessMidtransCallback implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public array $payload;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [15, 45, 90];

    public int $timeout = 60;

    public function __construct(array $payload)
    {
        $this->payload = $payload;
    }

    /**
     * Execute the job.
     * SRS 14.2 / 16.5 — wallet credit dual-writes via WalletLedgerService (type=topup).
     */
    public function handle(?WalletLedgerService $ledgerService = null): void
    {
        $ledgerService ??= app(WalletLedgerService::class);

        $orderId = $this->payload['order_id'] ?? null;
        $midtransStatus = $this->payload['transaction_status'] ?? null;
        $paymentType = $this->payload['payment_type'] ?? null;
        $grossAmount = $this->payload['gross_amount'] ?? 0.00;

        if (!$orderId || !$midtransStatus) {
            Log::error('ProcessMidtransCallback: Invalid payload structure', ['payload' => $this->payload]);

            return;
        }

        Log::info('Processing Midtrans callback queue job', [
            'order_id' => $orderId,
            'status' => $midtransStatus,
            'gross_amount' => $grossAmount,
        ]);

        $midtransTx = MidtransTransaction::where('order_id', $orderId)->first();
        $transaction = $midtransTx?->transaction
            ?? Transaction::where('invoice_number', $orderId)->first();

        if (!$transaction) {
            Log::warning("ProcessMidtransCallback: Transaction with invoice/order_id '{$orderId}' not found in database.");

            return;
        }

        if (!$midtransTx) {
            $midtransTx = MidtransTransaction::create([
                'transaction_id' => $transaction->id,
                'order_id' => $orderId,
                'payment_type' => $paymentType,
                'gross_amount' => (float) $grossAmount,
                'transaction_status' => $midtransStatus,
                'raw_notification' => $this->payload,
            ]);
        } else {
            $midtransTx->update([
                'payment_type' => $paymentType,
                'transaction_status' => $midtransStatus,
                'raw_notification' => $this->payload,
            ]);
        }

        $localStatus = $this->mapStatus($midtransStatus, $this->payload['fraud_status'] ?? null);
        $isRefundSignal = in_array(strtolower((string) $midtransStatus), ['refund', 'partial_refund'], true);

        DB::transaction(function () use (
            $transaction,
            $midtransTx,
            $localStatus,
            $midtransStatus,
            $grossAmount,
            $ledgerService,
            $isRefundSignal
        ) {
            /** @var Transaction|null $locked */
            $locked = Transaction::where('id', $transaction->id)->lockForUpdate()->first();
            if (!$locked) {
                return;
            }

            $isTopUp = TransactionStatusMapper::isWalletTopUp($locked);
            $alreadyCredited = $isTopUp && $this->topUpCreditExists($locked);

            if ($isRefundSignal && $isTopUp) {
                $this->processTopUpRefundSignal($locked, $midtransStatus);

                return;
            }

            if ($alreadyCredited || TransactionStatusMapper::isSuccess($locked->status)) {
                Log::info('ProcessMidtransCallback: settlement already applied — idempotent skip', [
                    'transaction_id' => $locked->id,
                    'invoice' => $locked->invoice_number,
                    'already_credited' => $alreadyCredited,
                ]);
                $this->recordMidtransMetric($locked, $localStatus, $midtransStatus, $grossAmount);

                return;
            }

            if ($localStatus === TransactionStatus::SUCCESS->value) {
                $this->processSettlement($locked, $midtransStatus, $grossAmount, $ledgerService, $isTopUp);

                return;
            }

            if ($this->isTerminalLocalStatus($localStatus)) {
                if (TransactionStatusMapper::isTerminalFailureRaw($locked->status)) {
                    $this->recordMidtransMetric($locked, $localStatus, $midtransStatus, $grossAmount);

                    return;
                }

                $locked->update([
                    'status' => $localStatus,
                    'notes' => 'Transaksi dibatalkan atau kedaluwarsa dari Midtrans. Status: ' . $midtransStatus,
                ]);

                event(new \App\Events\TransactionFailed($locked->fresh()));
                $this->recordMidtransMetric($locked, $localStatus, $midtransStatus, $grossAmount);

                return;
            }

            // Pending / challenge — never mark as payment_failed.
            if (!TransactionStatusMapper::isSuccess($locked->status)
                && !TransactionStatusMapper::isTerminalFailureRaw($locked->status)) {
                $locked->update([
                    'status' => TransactionStatus::PROCESSING->value,
                    'notes' => 'Menunggu penyelesaian pembayaran di Midtrans.',
                ]);
            }

            $this->recordMidtransMetric($locked, $localStatus, $midtransStatus, $grossAmount);
        });
    }

    protected function processSettlement(
        Transaction $transaction,
        string $midtransStatus,
        mixed $grossAmount,
        WalletLedgerService $ledgerService,
        bool $isTopUp
    ): void {
        if (TransactionStatusMapper::isTerminalFailureRaw($transaction->status)) {
            $this->recordLateSettlementOnTerminal($transaction, $midtransStatus, (float) $grossAmount);

            return;
        }

        $expected = (float) $transaction->total_payment;
        $received = (float) $grossAmount;

        if (abs($received - $expected) > 0.01) {
            Log::critical('ProcessMidtransCallback: gross_amount mismatch — refusing to credit wallet', [
                'transaction_id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'expected_total_payment' => $expected,
                'webhook_gross_amount' => $received,
            ]);

            \App\Models\ActivityLog::create([
                'user_id' => $transaction->user_id,
                'activity' => 'MIDTRANS_AMOUNT_MISMATCH',
                'payload' => [
                    'transaction_id' => $transaction->id,
                    'invoice_number' => $transaction->invoice_number,
                    'expected_total_payment' => $expected,
                    'webhook_gross_amount' => $received,
                    'midtrans_status' => $midtransStatus,
                ],
            ]);

            $this->recordMidtransMetric($transaction, TransactionStatus::PENDING->value, $midtransStatus, $grossAmount);

            return;
        }

        if ($isTopUp) {
            $wallet = Wallet::where('user_id', $transaction->user_id)->lockForUpdate()->first();
            if (!$wallet) {
                Log::critical('ProcessMidtransCallback: wallet missing — refusing SUCCESS without credit', [
                    'transaction_id' => $transaction->id,
                    'user_id' => $transaction->user_id,
                ]);

                throw new \RuntimeException('Wallet tidak ditemukan untuk Top Up Midtrans.');
            }

            if ($this->topUpCreditExists($transaction, (int) $wallet->id)) {
                $this->recordMidtransMetric($transaction, TransactionStatus::SUCCESS->value, $midtransStatus, $grossAmount);

                return;
            }

            $wallet->balance += (float) $transaction->amount;
            $wallet->save();

            $desc = 'Top Up Saldo - Invoice: ' . $transaction->invoice_number;
            $ledgerService->record(
                $wallet,
                WalletMutation::TYPE_TOPUP,
                (float) $transaction->amount,
                'credit',
                $desc,
                $transaction->id
            );

            Log::info('Wallet credited successfully from Midtrans Settlement', [
                'user_id' => $transaction->user_id,
                'amount' => $transaction->amount,
            ]);

            event(new \App\Events\WalletCredited($wallet, (float) $transaction->amount, $desc, $transaction->id));
        }

        $transaction->update([
            'status' => TransactionStatus::SUCCESS->value,
            'notes' => 'Pembayaran berhasil dikonfirmasi oleh Midtrans.',
        ]);

        PaymentHistory::recordFor(
            $transaction,
            'midtrans',
            $midtransStatus === 'capture' ? 'capture' : 'settlement',
            $this->payload,
            $this->payload,
            $transaction->invoice_number
        );

        event(new \App\Events\PaymentSettled($transaction->fresh(), $this->payload));
        event(new \App\Events\TransactionSuccess($transaction->fresh()));

        $this->recordMidtransMetric($transaction, TransactionStatus::SUCCESS->value, $midtransStatus, $grossAmount);
    }

    protected function processTopUpRefundSignal(Transaction $transaction, string $midtransStatus): void
    {
        if ($this->topUpCreditExists($transaction)) {
            Log::critical('ProcessMidtransCallback: Midtrans refund on credited Top Up — manual reconciliation required', [
                'transaction_id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'midtrans_status' => $midtransStatus,
            ]);

            \App\Models\ActivityLog::create([
                'user_id' => $transaction->user_id,
                'activity' => 'MIDTRANS_TOPUP_REFUND_REQUIRES_MANUAL',
                'payload' => [
                    'transaction_id' => $transaction->id,
                    'invoice_number' => $transaction->invoice_number,
                    'midtrans_status' => $midtransStatus,
                    'message' => 'Top Up was credited locally; Midtrans refund requires manual financial review.',
                ],
            ]);

            try {
                app(ReconciliationIncidentService::class)->openOrRefresh([
                    'fingerprint' => 'midtrans_topup_refund:'.$transaction->id,
                    'type' => \App\Models\ReconciliationIncident::TYPE_MIDTRANS_SETTLEMENT,
                    'source' => 'midtrans',
                    'user_id' => $transaction->user_id,
                    'expected_amount' => (float) $transaction->amount,
                    'actual_amount' => 0,
                    'variance' => (float) $transaction->amount,
                    'threshold' => 0,
                    'freeze_withdraw' => false,
                    'restrict_purchase' => false,
                    'system_wide_freeze' => false,
                    'notes' => 'Midtrans refund/partial_refund on credited Top Up — manual reversal required.',
                    'meta' => [
                        'transaction_id' => $transaction->id,
                        'invoice_number' => $transaction->invoice_number,
                        'midtrans_status' => $midtransStatus,
                    ],
                ]);
            } catch (\Throwable $e) {
                Log::warning('ProcessMidtransCallback: failed to open refund incident', [
                    'transaction_id' => $transaction->id,
                    'error' => $e->getMessage(),
                ]);
            }

            $transaction->update([
                'notes' => trim((string) $transaction->notes.' | Midtrans '.$midtransStatus.' — requires manual reconciliation.'),
            ]);

            $this->recordMidtransMetric($transaction, TransactionStatus::FAILED->value, $midtransStatus, $this->payload['gross_amount'] ?? 0);

            return;
        }

        if (!TransactionStatusMapper::isTerminalFailureRaw($transaction->status)) {
            $transaction->update([
                'status' => TransactionStatus::FAILED->value,
                'notes' => 'Pembayaran Top Up ditolak/direfund oleh Midtrans. Status: '.$midtransStatus,
            ]);
            event(new \App\Events\TransactionFailed($transaction->fresh()));
        }

        $this->recordMidtransMetric($transaction, TransactionStatus::FAILED->value, $midtransStatus, $this->payload['gross_amount'] ?? 0);
    }

    protected function recordLateSettlementOnTerminal(Transaction $transaction, string $midtransStatus, float $grossAmount): void
    {
        Log::critical('ProcessMidtransCallback: late settlement on terminal Top Up — refusing auto credit', [
            'transaction_id' => $transaction->id,
            'invoice_number' => $transaction->invoice_number,
            'local_status' => $transaction->status,
            'midtrans_status' => $midtransStatus,
        ]);

        \App\Models\ActivityLog::create([
            'user_id' => $transaction->user_id,
            'activity' => 'MIDTRANS_LATE_SETTLEMENT_ON_TERMINAL',
            'payload' => [
                'transaction_id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'local_status' => $transaction->status,
                'midtrans_status' => $midtransStatus,
                'gross_amount' => $grossAmount,
            ],
        ]);

        try {
            app(ReconciliationIncidentService::class)->openOrRefresh([
                'fingerprint' => 'midtrans_late_settlement:'.$transaction->id,
                'type' => \App\Models\ReconciliationIncident::TYPE_MIDTRANS_SETTLEMENT,
                'source' => 'midtrans',
                'user_id' => $transaction->user_id,
                'expected_amount' => 0,
                'actual_amount' => $grossAmount,
                'variance' => $grossAmount,
                'threshold' => 0,
                'freeze_withdraw' => false,
                'restrict_purchase' => false,
                'system_wide_freeze' => false,
                'notes' => 'Late Midtrans settlement received after local terminal failure state.',
                'meta' => [
                    'transaction_id' => $transaction->id,
                    'invoice_number' => $transaction->invoice_number,
                    'local_status' => $transaction->status,
                    'midtrans_status' => $midtransStatus,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('ProcessMidtransCallback: failed to open late-settlement incident', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);
        }

        $this->recordMidtransMetric($transaction, TransactionStatus::PENDING->value, $midtransStatus, $grossAmount);
    }

    protected function topUpCreditExists(Transaction $transaction, ?int $walletId = null): bool
    {
        $query = WalletMutation::query()
            ->where('reference_id', (string) $transaction->id)
            ->where('type', WalletMutation::TYPE_TOPUP);

        if ($walletId !== null) {
            $query->where('wallet_id', $walletId);
        }

        return $query->exists();
    }

    protected function isTerminalLocalStatus(string $localStatus): bool
    {
        return in_array($localStatus, [
            TransactionStatus::FAILED->value,
            TransactionStatus::CANCELED->value,
            TransactionStatus::EXPIRED->value,
        ], true);
    }

    protected function metricTypeFor(string $localStatus, string $midtransStatus): string
    {
        if ($localStatus === TransactionStatus::SUCCESS->value) {
            return 'payment_success';
        }

        if (in_array($localStatus, [
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ], true)) {
            return 'payment_pending';
        }

        if ($localStatus === TransactionStatus::EXPIRED->value) {
            return 'payment_expired';
        }

        if ($localStatus === TransactionStatus::CANCELED->value) {
            return 'payment_canceled';
        }

        if ($localStatus === TransactionStatus::FAILED->value) {
            return 'payment_failed';
        }

        if (in_array(strtolower($midtransStatus), ['pending', 'challenge'], true)) {
            return 'payment_pending';
        }

        return 'payment_pending';
    }

    protected function recordMidtransMetric(
        Transaction $transaction,
        string $localStatus,
        string $midtransStatus,
        mixed $grossAmount
    ): void {
        $settlementTime = now()->diffInSeconds($transaction->created_at);

        $callbackDelay = 0;
        if (isset($this->payload['transaction_time'])) {
            try {
                $txTime = \Carbon\Carbon::parse($this->payload['transaction_time']);
                $callbackDelay = now()->diffInSeconds($txTime);
            } catch (\Exception $e) {
                $callbackDelay = 0;
            }
        }

        $metricType = $this->metricTypeFor($localStatus, $midtransStatus);

        \App\Models\ActivityLog::create([
            'user_id' => $transaction->user_id,
            'activity' => 'midtrans_callback_metric',
            'payload' => [
                'order_id' => $transaction->invoice_number,
                'metric_type' => $metricType,
                'local_status' => $localStatus,
                'midtrans_status' => $midtransStatus,
                'settlement_time_seconds' => $settlementTime,
                'callback_delay_seconds' => $callbackDelay,
                'gross_amount' => (float) $grossAmount,
            ],
        ]);

        Log::info('[METRIC] Midtrans Callback processed', [
            'metric_type' => $metricType,
            'order_id' => $transaction->invoice_number,
            'settlement_time_seconds' => $settlementTime,
            'callback_delay_seconds' => $callbackDelay,
            'gross_amount' => (float) $grossAmount,
        ]);
    }

    /**
     * Map Midtrans payment status to local TransactionStatus.
     */
    protected function mapStatus(string $status, ?string $fraudStatus): string
    {
        $status = strtolower($status);

        switch ($status) {
            case 'settlement':
                return TransactionStatus::SUCCESS->value;
            case 'capture':
                if (strtolower((string) $fraudStatus) === 'accept') {
                    return TransactionStatus::SUCCESS->value;
                }
                if (strtolower((string) $fraudStatus) === 'deny') {
                    return TransactionStatus::FAILED->value;
                }
                if (strtolower((string) $fraudStatus) === 'challenge') {
                    return TransactionStatus::PENDING->value;
                }

                return TransactionStatus::PENDING->value;
            case 'pending':
                return TransactionStatus::PENDING->value;
            case 'challenge':
                return TransactionStatus::PENDING->value;
            case 'expire':
                return TransactionStatus::EXPIRED->value;
            case 'cancel':
                return TransactionStatus::CANCELED->value;
            case 'deny':
            case 'failure':
                return TransactionStatus::FAILED->value;
            case 'refund':
            case 'partial_refund':
                return TransactionStatus::FAILED->value;
            default:
                return TransactionStatus::PENDING->value;
        }
    }
}
