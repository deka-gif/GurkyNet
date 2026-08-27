<?php

namespace App\Actions\Transaction;

use App\Models\Transaction;
use App\Repositories\Contracts\TransactionRepositoryInterface;
use App\Enums\TransactionStatus;
use App\Services\WalletRefundService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Safe user/system cancel before provider dispatch.
 * FR-DIFF-09 / SRS 14.5 — held-fund release (unhold) uses WalletRefundService
 * so ledger/audit/idempotency markers match the official refund path.
 */
class CancelTransactionAction
{
    protected TransactionRepositoryInterface $transactionRepository;
    protected WalletRefundService $refundService;

    public function __construct(
        TransactionRepositoryInterface $transactionRepository,
        WalletRefundService $refundService
    ) {
        $this->transactionRepository = $transactionRepository;
        $this->refundService = $refundService;
    }

    /**
     * SRS 14.3 / 15.3 — safe cancel only for INITIATED or LOCKED (no provider dispatch).
     * Unsafe: SENT_TO_SUPPLIER, PENDING_SUPPLIER, PROCESSING, or provider_dispatch_started_at set.
     * Legacy `pending` without dispatch still unholds (pre–Sprint 3 held rows).
     */
    public function execute(Transaction $transaction, ?string $reason = null): Transaction
    {
        return DB::transaction(function () use ($transaction, $reason) {
            $lockedTransaction = Transaction::where('id', $transaction->id)->lockForUpdate()->first();

            $raw = (string) $lockedTransaction->status;
            $srs = TransactionStatusMapper::toSrs($raw);

            if (in_array($srs, ['SUCCESS', 'FAILED', 'REFUNDED'], true) || in_array($raw, [
                TransactionStatus::CANCELED->value,
                TransactionStatus::EXPIRED->value,
            ], true)) {
                throw ValidationException::withMessages([
                    'transaction' => ['Transaksi tidak dapat dibatalkan karena sudah selesai, gagal, atau telah dibatalkan sebelumnya.'],
                ]);
            }

            $unsafeToCancel = in_array($raw, [
                    TransactionStatus::SENT_TO_SUPPLIER->value,
                    TransactionStatus::PENDING_SUPPLIER->value,
                    TransactionStatus::PROCESSING->value,
                ], true)
                || $lockedTransaction->provider_dispatch_started_at !== null;

            if ($unsafeToCancel) {
                throw ValidationException::withMessages([
                    'transaction' => ['Transaksi sudah dikirim ke penyedia layanan dan tidak dapat dibatalkan langsung. Sistem akan menyelesaikan status transaksi secara otomatis.'],
                ]);
            }

            // SAFE CANCEL: INITIATED (no hold / total may be 0) or LOCKED without dispatch (unhold).
            $canUnhold = in_array($raw, [
                TransactionStatus::LOCKED->value,
                TransactionStatus::PENDING->value,
                TransactionStatus::DRAFT->value,
            ], true);

            if ($canUnhold && (float) $lockedTransaction->total_payment > 0) {
                // FR-DIFF-09 — do not credit wallet outside WalletRefundService.
                $result = $this->refundService->refundOnce(
                    $lockedTransaction,
                    'Refund Pembatalan Transaksi: '.$lockedTransaction->invoice_number,
                    'user_cancel',
                    $reason ?? 'Transaksi dibatalkan oleh pengguna atau sistem',
                    TransactionStatus::CANCELED->value
                );

                $this->refundService->writeAudit(
                    auth()->id(),
                    $result['already_refunded'] ? 'TRANSACTION_CANCEL_ALREADY_REFUNDED' : 'TRANSACTION_CANCEL_UNHOLD',
                    [
                        'transaction_id' => $lockedTransaction->id,
                        'invoice_number' => $lockedTransaction->invoice_number,
                        'credited' => $result['credited'],
                        'final_status' => $result['transaction']->status ?? null,
                    ]
                );

                event(new \App\Events\TransactionFailed($result['transaction']));

                return $result['transaction'];
            }

            $lockedTransaction->status = TransactionStatus::CANCELED->value;
            $lockedTransaction->notes = $reason ?? 'Transaksi dibatalkan oleh pengguna atau sistem';
            $lockedTransaction->save();

            event(new \App\Events\TransactionFailed($lockedTransaction));

            return $lockedTransaction;
        });
    }
}
