<?php

namespace App\Jobs;

use App\Models\Transaction;
use App\Models\DigiflazzTransaction;
use App\Models\PaymentHistory;
use App\Models\User;
use App\Services\DigiflazzService;
use App\Services\NotificationService;
use App\Services\WalletRefundService;
use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessDigiflazzTransaction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $transactionId;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 60, 120];

    public int $timeout = 90;

    public function __construct(int $transactionId)
    {
        $this->transactionId = $transactionId;
    }

    public function handle(DigiflazzService $digiflazzService, WalletRefundService $refundService): void
    {
        $transaction = Transaction::with(['items'])->find($this->transactionId);
        if (!$transaction) {
            Log::error('ProcessDigiflazzTransaction: Transaction not found', ['id' => $this->transactionId]);
            return;
        }

        if ($transaction->status !== TransactionStatus::PENDING->value
            && $transaction->status !== TransactionStatus::PROCESSING->value) {
            Log::info('ProcessDigiflazzTransaction: Transaction already processed or not in queueable state', [
                'id' => $this->transactionId,
                'status' => $transaction->status,
            ]);
            return;
        }

        $firstItem = $transaction->items->first();
        $sku = $firstItem ? $firstItem->product_code : '';

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
            Log::info('Dispatching Digiflazz buy request', [
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

            $digiflazzTx->update([
                'digiflazz_status' => $digiflazzStatus,
                'sn' => $sn,
                'raw_response' => $response,
            ]);

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
                $result = $refundService->refundOnce(
                    $transaction,
                    'Refund Gagal Transaksi: ' . $transaction->invoice_number,
                    'digiflazz_job',
                    'Transaksi gagal dari operator.',
                    TransactionStatus::FAILED->value
                );

                $refundService->writeAudit(null, 'DIGIFLAZZ_JOB_FAILED_REFUND', [
                    'transaction_id' => $transaction->id,
                    'credited' => $result['credited'],
                    'already_refunded' => $result['already_refunded'],
                ]);

                event(new \App\Events\TransactionFailed($result['transaction']));
            } else {
                $transaction->update([
                    'status' => TransactionStatus::PROCESSING->value,
                    'notes' => 'Sedang diproses oleh operator.',
                ]);
            }
        } catch (\Exception $e) {
            Log::error('ProcessDigiflazzTransaction job execution failure', [
                'transaction_id' => $this->transactionId,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Permanent failure after all retries — mark failed, refund once, notify.
     */
    public function failed(?\Throwable $exception): void
    {
        $refundService = app(WalletRefundService::class);
        $notificationService = app(NotificationService::class);

        $transaction = Transaction::with('user')->find($this->transactionId);
        if (!$transaction) {
            return;
        }

        // Only refund if still in-flight (not already success/canceled/failed+refunded).
        if (!in_array($transaction->status, [
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ], true)) {
            Log::info('ProcessDigiflazzTransaction::failed skipped — transaction not in-flight', [
                'transaction_id' => $this->transactionId,
                'status' => $transaction->status,
            ]);
            return;
        }

        $result = $refundService->refundOnce(
            $transaction,
            'Refund Gagal Transaksi (Job Exhausted): ' . $transaction->invoice_number,
            'digiflazz_job_failed',
            'Transaksi gagal permanen setelah retry Digiflazz: ' . ($exception?->getMessage() ?? 'unknown'),
            TransactionStatus::FAILED->value
        );

        $refundService->writeAudit(null, 'DIGIFLAZZ_JOB_EXHAUSTED_REFUND', [
            'transaction_id' => $transaction->id,
            'invoice_number' => $transaction->invoice_number,
            'error' => $exception?->getMessage(),
            'credited' => $result['credited'],
            'already_refunded' => $result['already_refunded'],
        ]);

        DigiflazzTransaction::where('transaction_id', $transaction->id)->update([
            'digiflazz_status' => 'failed',
        ]);

        $fresh = $result['transaction'];
        event(new \App\Events\TransactionFailed($fresh));

        if ($fresh->user) {
            $notificationService->send(
                $fresh->user,
                'Transaksi Gagal',
                'Transaksi ' . $fresh->invoice_number . ' gagal diproses oleh provider. Saldo telah dikembalikan ke dompet Anda.',
                'transaction_failed',
                ['database']
            );
        }

        User::query()
            ->whereIn('role', [UserRole::FINANCE->value, UserRole::OWNER->value])
            ->orderBy('id')
            ->chunkById(50, function ($users) use ($notificationService, $fresh, $exception) {
                foreach ($users as $user) {
                    $notificationService->send(
                        $user,
                        'Digiflazz Job Failed',
                        'Transaksi ' . $fresh->invoice_number . ' gagal permanen setelah retry. '
                            . ($exception?->getMessage() ?? ''),
                        'provider_failure',
                        ['database']
                    );
                }
            });

        Log::error('ProcessDigiflazzTransaction permanently failed', [
            'transaction_id' => $this->transactionId,
            'credited' => $result['credited'],
            'error' => $exception?->getMessage(),
        ]);
    }
}
