<?php

namespace App\Services\Transactions;

use App\Models\FinanceAlert;
use App\Models\Transaction;
use App\Services\Operations\OpsAlertService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\Log;

/**
 * Shared escalate path when Digi/VIP outcome is unknown (job exhausted, worker kill, etc.).
 * Same principle as TransactionTimeoutService soft-timeout backstop: never auto-refund.
 */
class PpobManualReviewEscalationService
{
    /**
     * Keep transaction in-flight, flag manual_review, open Finance + Ops alerts.
     * No wallet credit.
     */
    public function escalate(Transaction $transaction, string $source, string $detail = ''): void
    {
        if (! TransactionStatusMapper::isFulfillOpen($transaction->status)) {
            Log::info('PPOB manual review escalate skipped — not in-flight', [
                'transaction_id' => $transaction->id,
                'status' => $transaction->status,
                'source' => $source,
            ]);

            return;
        }

        if (($transaction->provider_last_status ?? '') === 'manual_review') {
            Log::info('PPOB manual review already flagged', [
                'transaction_id' => $transaction->id,
                'source' => $source,
            ]);

            return;
        }

        $note = 'Menunggu konfirmasi operator. Tim Operations akan meninjau — saldo belum dikembalikan otomatis.';
        if ($detail !== '') {
            $note .= ' ('.$detail.')';
        }
        $existing = trim((string) $transaction->notes);

        $transaction->forceFill([
            'provider_last_status' => 'manual_review',
            'notes' => mb_substr($existing === '' ? $note : ($existing.' | '.$note), 0, 2000),
        ])->save();

        Log::critical('PPOB manual review required (no auto-refund)', [
            'transaction_id' => $transaction->id,
            'invoice' => $transaction->invoice_number,
            'source' => $source,
            'detail' => $detail,
            'provider_code' => $transaction->fulfillment_provider_code,
            'provider_ref' => $transaction->provider_ref,
        ]);

        $this->persistAlerts($transaction, $source, $detail);
    }

    /**
     * Batch physical item: worker died / unknown reason — leave PROCESSING, alert Ops/Finance.
     */
    public function escalateBatchItem(int $batchItemId, int $transactionId, string $invoice, string $serial, string $source): void
    {
        Log::critical('PPOB physical batch item needs manual review (no auto-refund)', [
            'batch_item_id' => $batchItemId,
            'transaction_id' => $transactionId,
            'invoice' => $invoice,
            'serial' => $serial,
            'source' => $source,
        ]);

        $payload = [
            'batch_item_id' => $batchItemId,
            'transaction_id' => $transactionId,
            'invoice' => $invoice,
            'serial' => $serial,
            'source' => $source,
        ];

        try {
            $exists = FinanceAlert::query()
                ->where('type', 'ppob_manual_review')
                ->where('related_type', 'voucher_physical_batch_item')
                ->where('related_id', $batchItemId)
                ->where('status', 'open')
                ->exists();
            if (! $exists) {
                FinanceAlert::query()->create([
                    'alert_code' => sprintf('ALT-MR-BATCH-%s-%d', now()->format('YmdHis'), $batchItemId),
                    'type' => 'ppob_manual_review',
                    'severity' => 'critical',
                    'title' => 'Voucher fisik butuh review: '.$invoice.' / '.$serial,
                    'body' => 'Item batch kehabisan retry tanpa bukti gagal Digi eksplisit ('.$source.'). Jangan auto-refund — cek Digi lalu settle manual.',
                    'payload' => $payload,
                    'status' => 'open',
                    'related_type' => 'voucher_physical_batch_item',
                    'related_id' => $batchItemId,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('PPOB batch manual review finance alert failed', [
                'batch_item_id' => $batchItemId,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            app(OpsAlertService::class)->raiseOpen(
                'ppob_manual_review',
                'critical',
                'Voucher fisik butuh review: '.$invoice.' / '.$serial,
                'Item batch tanpa failure_reason pasti ('.$source.'). Jangan auto-refund.',
                $payload,
                'voucher_physical_batch_item',
                $batchItemId
            );
        } catch (\Throwable $e) {
            Log::error('PPOB batch manual review ops alert failed', [
                'batch_item_id' => $batchItemId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function persistAlerts(Transaction $transaction, string $source, string $detail): void
    {
        $attrs = [
            'alert_code' => sprintf('ALT-MR-%s-%d', now()->format('YmdHis'), (int) $transaction->id),
            'type' => 'ppob_manual_review',
            'severity' => 'critical',
            'title' => 'PPOB butuh review manual: '.$transaction->invoice_number,
            'body' => 'Transaksi tanpa jawaban final Digi/VIP (sumber: '.$source.'). '
                .'Jangan auto-refund — cek Digi dashboard / SN lalu settle manual.'
                .($detail !== '' ? ' Detail: '.$detail : ''),
            'payload' => [
                'transaction_id' => $transaction->id,
                'invoice' => $transaction->invoice_number,
                'source' => $source,
                'detail' => $detail,
                'provider_code' => $transaction->fulfillment_provider_code,
                'provider_ref' => $transaction->provider_ref,
                'provider_last_status' => 'manual_review',
                'service_name' => $transaction->service_name,
            ],
            'status' => 'open',
            'related_type' => 'transaction',
            'related_id' => (int) $transaction->id,
        ];

        try {
            $exists = FinanceAlert::query()
                ->where('type', 'ppob_manual_review')
                ->where('related_type', 'transaction')
                ->where('related_id', $transaction->id)
                ->where('status', 'open')
                ->exists();
            if (! $exists) {
                FinanceAlert::query()->create($attrs);
            }
        } catch (\Throwable $e) {
            Log::error('PPOB manual review finance alert failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            app(OpsAlertService::class)->raiseOpen(
                (string) $attrs['type'],
                (string) $attrs['severity'],
                (string) $attrs['title'],
                (string) $attrs['body'],
                is_array($attrs['payload']) ? $attrs['payload'] : [],
                'transaction',
                (int) $transaction->id
            );
        } catch (\Throwable $e) {
            Log::error('PPOB manual review ops alert failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
