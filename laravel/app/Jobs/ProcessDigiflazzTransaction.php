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
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Legacy Digiflazz-only fulfillment job.
 *
 * Sprint 3 (SRS 15.3) — ShouldBeUnique (keyed by transaction id) prevents two queued
 * instances of this job from ever running concurrently for the same transaction, on top
 * of the atomic `provider_dispatch_started_at` claim added below.
 */
class ProcessDigiflazzTransaction implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $transactionId;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 60, 120];

    public int $timeout = 90;

    /**
     * Unique lock lifetime — matches $timeout so the lock never outlives a single attempt.
     */
    public int $uniqueFor = 90;

    public function __construct(int $transactionId)
    {
        $this->transactionId = $transactionId;
    }

    public function uniqueId(): string
    {
        return (string) $this->transactionId;
    }

    public function handle(DigiflazzService $digiflazzService, WalletRefundService $refundService): void
    {
        $transaction = Transaction::with(['items'])->find($this->transactionId);
        if (!$transaction) {
            Log::error('ProcessDigiflazzTransaction: Transaction not found', ['id' => $this->transactionId]);
            return;
        }

        // SRS 14.3 — accept LOCKED (and legacy pending/processing) for first dispatch.
        if (!TransactionStatusMapper::isFulfillOpen($transaction->status)) {
            Log::info('ProcessDigiflazzTransaction: Transaction already processed or not in queueable state', [
                'id' => $this->transactionId,
                'status' => $transaction->status,
            ]);
            return;
        }

        // Sprint 3 (SRS 15.3 / locked decision #2) — atomic local claim. If a prior attempt
        // already claimed this transaction (retry after an ambiguous exception/timeout),
        // never blindly call buy() again — go through the three-outcome retry guard instead.
        // SRS 14.3 — stamp SENT_TO_SUPPLIER when starting provider send.
        $claimed = Transaction::where('id', $transaction->id)
            ->whereIn('status', TransactionStatusMapper::dispatchClaimStatuses())
            ->whereNull('provider_dispatch_started_at')
            ->update([
                'provider_dispatch_started_at' => now(),
                'status' => TransactionStatus::SENT_TO_SUPPLIER->value,
            ]);

        if ($claimed === 0) {
            $this->handleDispatchRetry($transaction->fresh(['items']) ?? $transaction, $digiflazzService, $refundService);

            return;
        }

        $transaction = $transaction->fresh(['items']) ?? $transaction;

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

            // Map Digiflazz Sukses/Pending/Gagal → GurkyNet success/pending/failed (legacy job path).
            if (in_array($digiflazzStatus, ['sukses'], true)) {
                $digiflazzStatus = 'success';
            } elseif (in_array($digiflazzStatus, ['gagal'], true)) {
                $digiflazzStatus = 'failed';
            }

            $digiflazzTx->update(
                DigiflazzService::digiflazzTransactionAttributesFromResponse(
                    $digiflazzStatus,
                    is_array($response) ? $response : [],
                    is_string($sn) ? $sn : null
                )
            );

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
                // SRS 14.3 — unclear supplier outcome → PENDING_SUPPLIER
                $transaction->update([
                    'status' => TransactionStatus::PENDING_SUPPLIER->value,
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
     * Sprint 3 (SRS 15.3 / locked decision #2/#9) — three-outcome retry guard. Invoked only
     * when a prior dispatch attempt already claimed this transaction. Never calls buy()
     * again; only checkStatus() may run, and only one of three outcomes may result:
     *
     *   A. CONFIRMED EXISTS  — apply existing success handling, never resend.
     *   B. CONFIRMED FAILED  — existing refundOnce() path, never dispatch again.
     *   C. UNKNOWN / TIMEOUT — no resend, no refund; existing TransactionTimeoutService /
     *      transactions:reconcile-pending resolves it.
     */
    protected function handleDispatchRetry(
        Transaction $transaction,
        DigiflazzService $digiflazzService,
        WalletRefundService $refundService
    ): void {
        if (!TransactionStatusMapper::isFulfillOpen($transaction->status)) {
            return;
        }

        $firstItem = $transaction->items->first();
        $sku = $firstItem ? $firstItem->product_code : '';

        if ($sku === '') {
            Log::warning('ProcessDigiflazzTransaction: dispatch retry with no SKU context, deferring to reconciliation', [
                'transaction_id' => $transaction->id,
            ]);

            return;
        }

        Log::info('ProcessDigiflazzTransaction: dispatch retry — checkStatus before any possible resend', [
            'transaction_id' => $transaction->id,
            'ref_id' => $transaction->invoice_number,
        ]);

        try {
            $response = $digiflazzService->checkStatus($sku, $transaction->target_number, $transaction->invoice_number);
        } catch (\Throwable $e) {
            Log::warning('ProcessDigiflazzTransaction: dispatch retry checkStatus failed, deferring to reconciliation', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            return;
        }

        $data = is_array($response) ? ($response['data'] ?? null) : null;
        if (!is_array($data)) {
            Log::warning('ProcessDigiflazzTransaction: dispatch retry inconclusive (empty data), deferring to reconciliation', [
                'transaction_id' => $transaction->id,
            ]);

            return;
        }

        $status = strtolower((string) ($data['status'] ?? 'pending'));
        $sn = $data['sn'] ?? null;

        if (in_array($status, ['sukses', 'success'], true)) {
            $digiflazzTx = DigiflazzTransaction::where('transaction_id', $transaction->id)->first();
            $digiflazzTx?->update(DigiflazzService::digiflazzTransactionAttributesFromResponse(
                'success',
                $response,
                is_string($sn) ? $sn : null
            ));

            $transaction->update([
                'status' => TransactionStatus::SUCCESS->value,
                'notes' => 'Transaksi sukses. SN: ' . ($sn ?? '-'),
            ]);

            PaymentHistory::recordFor($transaction, 'digiflazz', 'success', $response, $response, $transaction->invoice_number);

            event(new \App\Events\TransactionSuccess($transaction));
            event(new \App\Events\PaymentSettled($transaction, $response));

            return;
        }

        if (in_array($status, ['gagal', 'failed'], true)) {
            $result = $refundService->refundOnce(
                $transaction,
                'Refund Gagal Transaksi: ' . $transaction->invoice_number,
                'digiflazz_job_retry_check',
                'Transaksi gagal dari operator (dikonfirmasi via checkStatus).',
                TransactionStatus::FAILED->value
            );

            DigiflazzTransaction::where('transaction_id', $transaction->id)->update(['digiflazz_status' => 'failed']);

            $refundService->writeAudit(null, 'DIGIFLAZZ_JOB_RETRY_CHECK_FAILED_REFUND', [
                'transaction_id' => $transaction->id,
                'credited' => $result['credited'],
                'already_refunded' => $result['already_refunded'],
            ]);

            event(new \App\Events\TransactionFailed($result['transaction']));

            return;
        }

        // Outcome C — still pending / unresolved. Leave in-flight as PENDING_SUPPLIER;
        // existing reconciliation (TransactionTimeoutService / transactions:reconcile-pending) will settle it.
        $transaction->update([
            'status' => TransactionStatus::PENDING_SUPPLIER->value,
            'notes' => 'Sedang diproses oleh operator.',
        ]);

        Log::info('ProcessDigiflazzTransaction: dispatch retry still pending/unknown, deferring to reconciliation', [
            'transaction_id' => $transaction->id,
            'status' => $status,
        ]);
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
        if (!TransactionStatusMapper::isFulfillOpen($transaction->status)) {
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
