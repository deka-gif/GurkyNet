<?php

namespace App\Jobs;

use App\Models\Transaction;
use App\Models\MidtransTransaction;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\PaymentHistory;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
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

    /**
     * Create a new job instance.
     */
    public function __construct(array $payload)
    {
        $this->payload = $payload;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $orderId = $this->payload['order_id'] ?? null;
        $midtransStatus = $this->payload['transaction_status'] ?? null;
        $paymentType = $this->payload['payment_type'] ?? null;
        $grossAmount = $this->payload['gross_amount'] ?? 0.00;

        if (!$orderId || !$midtransStatus) {
            Log::error("ProcessMidtransCallback: Invalid payload structure", ['payload' => $this->payload]);
            return;
        }

        Log::info("Processing Midtrans callback queue job", [
            'order_id' => $orderId,
            'status' => $midtransStatus,
            'gross_amount' => $grossAmount,
        ]);

        // Locate or create MidtransTransaction record for traceability
        $midtransTx = MidtransTransaction::where('order_id', $orderId)->first();

        // If not found, look for general transaction by invoice number
        $transaction = null;
        if ($midtransTx) {
            $transaction = $midtransTx->transaction;
        } else {
            $transaction = Transaction::where('invoice_number', $orderId)->first();
        }

        if (!$transaction) {
            Log::warning("ProcessMidtransCallback: Transaction with invoice/order_id '{$orderId}' not found in database.");
            return;
        }

        // Initialize midtrans_transactions table entry if it wasn't pre-populated
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
            // Update tracking values
            $midtransTx->update([
                'payment_type' => $paymentType,
                'transaction_status' => $midtransStatus,
                'raw_notification' => $this->payload,
            ]);
        }

        // REPLAY & IDEMPOTENCY PROTECTION
        // If transaction is already marked successful, skip processing to prevent duplicate wallet credits
        if ($transaction->status === TransactionStatus::SUCCESS->value || $transaction->status === TransactionStatus::SUKSES->value) {
            Log::info("ProcessMidtransCallback: Transaction '{$orderId}' is already successful. Skipping.", [
                'transaction_id' => $transaction->id,
            ]);
            return;
        }

        // Map status
        $localStatus = $this->mapStatus($midtransStatus, $this->payload['fraud_status'] ?? null);

        DB::transaction(function () use ($transaction, $midtransTx, $localStatus, $midtransStatus, $grossAmount) {
            // Apply lock on the transaction to prevent concurrent updates
            $transaction = Transaction::where('id', $transaction->id)->lockForUpdate()->first();

            // Double check inside lock
            if ($transaction->status === TransactionStatus::SUCCESS->value || $transaction->status === TransactionStatus::SUKSES->value) {
                return;
            }

            if ($localStatus === TransactionStatus::SUCCESS->value) {
                // If it is a wallet top-up, execute the wallet credit
                if (strtolower($transaction->service_name) === 'top up saldo' || strtolower($transaction->service_name) === 'top up') {
                    $wallet = Wallet::where('user_id', $transaction->user_id)->lockForUpdate()->first();
                    if ($wallet) {
                        $wallet->balance += $transaction->amount;
                        $wallet->save();

                        // Add Wallet History
                        WalletHistory::create([
                            'wallet_id' => $wallet->id,
                            'amount' => $transaction->amount,
                            'type' => WalletHistoryType::CREDIT->value,
                            'description' => 'Top Up Saldo - Invoice: ' . $transaction->invoice_number,
                            'reference_id' => $transaction->id,
                        ]);

                        Log::info("Wallet credited successfully from Midtrans Settlement", [
                            'user_id' => $transaction->user_id,
                            'amount' => $transaction->amount,
                        ]);

                        event(new \App\Events\WalletCredited($wallet, $transaction->amount, 'Top Up Saldo - Invoice: ' . $transaction->invoice_number, $transaction->id));
                    }
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

                event(new \App\Events\PaymentSettled($transaction, $this->payload));
                event(new \App\Events\TransactionSuccess($transaction));

            } elseif ($localStatus === TransactionStatus::FAILED->value || $localStatus === TransactionStatus::CANCELED->value || $localStatus === TransactionStatus::EXPIRED->value) {
                $transaction->update([
                    'status' => $localStatus,
                    'notes' => 'Transaksi dibatalkan atau kedaluwarsa dari Midtrans. Status: ' . $midtransStatus,
                ]);

                event(new \App\Events\TransactionFailed($transaction));
            } else {
                // Pending/Processing
                $transaction->update([
                    'status' => TransactionStatus::PROCESSING->value,
                    'notes' => 'Menunggu penyelesaian pembayaran di Midtrans.',
                ]);
            }

            // MONITORING & METRIC RECORDING
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

            $metricType = ($localStatus === TransactionStatus::SUCCESS->value) ? 'payment_success' : 'payment_failed';

            // Save metrics to Activity Log
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
                ]
            ]);

            // Structured logging of metrics for easy analysis by log aggregators
            Log::info("[METRIC] Midtrans Callback processed", [
                'metric_type' => $metricType,
                'order_id' => $transaction->invoice_number,
                'settlement_time_seconds' => $settlementTime,
                'callback_delay_seconds' => $callbackDelay,
                'gross_amount' => (float) $grossAmount,
            ]);
        });
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
                if (strtolower($fraudStatus) === 'accept') {
                    return TransactionStatus::SUCCESS->value;
                }
                return TransactionStatus::PENDING->value;
            case 'pending':
                return TransactionStatus::PENDING->value;
            case 'expire':
                return TransactionStatus::EXPIRED->value;
            case 'cancel':
                return TransactionStatus::CANCELED->value;
            case 'deny':
                return TransactionStatus::FAILED->value;
            case 'refund':
            case 'partial_refund':
                // For direct tracking we can map refunds to failed/canceled/refunded state as needed
                return TransactionStatus::FAILED->value;
            default:
                return TransactionStatus::PENDING->value;
        }
    }
}
