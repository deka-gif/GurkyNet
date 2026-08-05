<?php

namespace App\Jobs;

use App\Models\Transaction;
use App\Models\DigiflazzTransaction;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\PaymentHistory;
use App\Services\DigiflazzService;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessDigiflazzTransaction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $transactionId;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 60, 120];

    public int $timeout = 90;

    /**
     * Create a new job instance.
     */
    public function __construct(int $transactionId)
    {
        $this->transactionId = $transactionId;
    }

    /**
     * Execute the job.
     */
    public function handle(DigiflazzService $digiflazzService): void
    {
        $transaction = Transaction::with(['items'])->find($this->transactionId);
        if (!$transaction) {
            Log::error("ProcessDigiflazzTransaction: Transaction not found", ['id' => $this->transactionId]);
            return;
        }

        // Only process pending or processing transactions
        if ($transaction->status !== TransactionStatus::PENDING->value && $transaction->status !== TransactionStatus::PROCESSING->value) {
            Log::info("ProcessDigiflazzTransaction: Transaction already processed or not in queueable state", [
                'id' => $this->transactionId,
                'status' => $transaction->status,
            ]);
            return;
        }

        $firstItem = $transaction->items->first();
        $sku = $firstItem ? $firstItem->product_code : '';

        // Retrieve or create DigiflazzTransaction
        $digiflazzTx = DigiflazzTransaction::firstOrCreate(
            ['transaction_id' => $transaction->id],
            [
                'ref_id' => $transaction->invoice_number,
                'buyer_sku_code' => $sku,
                'customer_no' => $transaction->target_number,
                'digiflazz_status' => 'pending',
            ]
        );

        try {
            // Call Digiflazz API
            Log::info("Dispatching Digiflazz buy request", [
                'transaction_id' => $transaction->id,
                'ref_id' => $transaction->invoice_number,
                'sku' => $sku,
                'customer_no' => $transaction->target_number,
            ]);

            $response = $digiflazzService->buy($sku, $transaction->target_number, $transaction->invoice_number);

            $data = $response['data'] ?? null;
            if (!$data) {
                throw new \Exception("Invalid or empty 'data' in Digiflazz API response: " . json_encode($response));
            }

            $digiflazzStatus = strtolower($data['status'] ?? 'pending');
            $sn = $data['sn'] ?? null;

            // Update local digiflazz record
            $digiflazzTx->update([
                'digiflazz_status' => $digiflazzStatus,
                'sn' => $sn,
                'raw_response' => $response,
            ]);

            // Handle mappings
            if ($digiflazzStatus === 'success') {
                $transaction->update([
                    'status' => TransactionStatus::SUCCESS->value,
                    'notes' => 'Transaksi sukses. SN: ' . ($sn ?? '-'),
                ]);

                PaymentHistory::recordFor(
                    $transaction,
                    'digiflazz',
                    'success',
                    $response,
                    $response,
                    $transaction->invoice_number
                );

                event(new \App\Events\TransactionSuccess($transaction));
                event(new \App\Events\PaymentSettled($transaction, is_array($response) ? $response : []));
            } elseif ($digiflazzStatus === 'failed') {
                DB::transaction(function () use ($transaction) {
                    $transaction->update([
                        'status' => TransactionStatus::FAILED->value,
                        'notes' => 'Transaksi gagal dari operator.',
                    ]);

                    // Refund Wallet Balance
                    $wallet = Wallet::where('user_id', $transaction->user_id)->lockForUpdate()->first();
                    if ($wallet) {
                        $wallet->balance += $transaction->total_payment;
                        $wallet->save();

                        WalletHistory::create([
                            'wallet_id' => $wallet->id,
                            'amount' => $transaction->total_payment,
                            'type' => WalletHistoryType::CREDIT->value,
                            'description' => 'Refund Gagal Transaksi: ' . $transaction->invoice_number,
                            'reference_id' => $transaction->id,
                        ]);

                        event(new \App\Events\WalletCredited(
                            $wallet,
                            (float) $transaction->total_payment,
                            'Refund Gagal Transaksi: ' . $transaction->invoice_number,
                            $transaction->id
                        ));

                        Log::info("Refund executed successfully for failed transaction", [
                            'transaction_id' => $transaction->id,
                            'amount' => $transaction->total_payment,
                        ]);
                    }
                });

                event(new \App\Events\TransactionFailed($transaction));
            } else {
                // Pending/Processing
                $transaction->update([
                    'status' => TransactionStatus::PROCESSING->value,
                    'notes' => 'Sedang diproses oleh operator.',
                ]);
            }

        } catch (\Exception $e) {
            Log::error("ProcessDigiflazzTransaction job execution failure", [
                'transaction_id' => $this->transactionId,
                'error' => $e->getMessage(),
            ]);

            // Re-throw exception so Laravel Queue handles standard retry/backoff
            throw $e;
        }
    }
}
