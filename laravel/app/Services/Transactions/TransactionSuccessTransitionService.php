<?php

namespace App\Services\Transactions;

use App\Enums\TransactionStatus;
use App\Models\DigiflazzTransaction;
use App\Models\PaymentHistory;
use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Services\DigiflazzService;
use App\Services\WalletRefundService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * SRS 14.3 / P0 — single locked writer for provider-fulfillment SUCCESS.
 *
 * All Digiflazz/VIP webhook, fulfill, poll/reconcile, and legacy Digiflazz job
 * SUCCESS paths must go through apply() so FAILED+refunded can never be revived
 * to SUCCESS, and duplicate SUCCESS is idempotent (no second events/mutations).
 */
class TransactionSuccessTransitionService
{
    public const OUTCOME_APPLIED = 'applied';

    public const OUTCOME_ALREADY_SUCCESS = 'already_success';

    public const OUTCOME_REJECTED_REFUNDED = 'rejected_refunded';

    public const OUTCOME_REJECTED_NOT_INFLIGHT = 'rejected_not_inflight';

    public function __construct(
        protected WalletRefundService $refundService
    ) {}

    /**
     * Atomically transition a purchase/fulfillment transaction to SUCCESS.
     *
     * @param  array{
     *     provider_code?: string|null,
     *     source?: string,
     *     sn?: string|null,
     *     notes?: string|null,
     *     raw?: mixed,
     *     raw_item?: mixed,
     *     provider_response?: mixed,
     *     sync_digiflazz_mirror?: bool,
     *     digiflazz_response?: array<string, mixed>|null
     * }  $context
     * @return array{
     *     outcome: string,
     *     transaction: Transaction,
     *     events_dispatched: bool
     * }
     */
    public function apply(int $transactionId, array $context = []): array
    {
        $providerCode = (string) ($context['provider_code'] ?? '');
        $source = (string) ($context['source'] ?? 'unknown');
        $sn = isset($context['sn']) && is_string($context['sn']) && $context['sn'] !== ''
            ? $context['sn']
            : null;
        $notes = isset($context['notes']) && is_string($context['notes']) && $context['notes'] !== ''
            ? $context['notes']
            : ('Transaksi berhasil. SN: '.($sn ?? '-'));
        $raw = $context['raw'] ?? null;
        $rawItem = $context['raw_item'] ?? $raw;
        $providerResponse = $context['provider_response'] ?? (is_array($raw) ? $raw : null);
        $syncDigiflazz = (bool) ($context['sync_digiflazz_mirror'] ?? ($providerCode === ProductProvider::CODE_DIGIFLAZZ));
        $digiflazzResponse = is_array($context['digiflazz_response'] ?? null)
            ? $context['digiflazz_response']
            : (is_array($raw) ? $raw : []);

        return DB::transaction(function () use (
            $transactionId,
            $providerCode,
            $source,
            $sn,
            $notes,
            $raw,
            $rawItem,
            $providerResponse,
            $syncDigiflazz,
            $digiflazzResponse
        ) {
            /** @var Transaction $locked */
            $locked = Transaction::where('id', $transactionId)->lockForUpdate()->firstOrFail();

            if (TransactionStatusMapper::isSuccess($locked->status)) {
                Log::info('TX SUCCESS TRANSITION — already SUCCESS (idempotent)', [
                    'transaction_id' => $locked->id,
                    'source' => $source,
                    'provider_code' => $providerCode !== '' ? $providerCode : null,
                ]);

                return [
                    'outcome' => self::OUTCOME_ALREADY_SUCCESS,
                    'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']) ?? $locked,
                    'events_dispatched' => false,
                ];
            }

            if ($locked->refunded_at || $this->refundService->hasExistingRefund($locked)) {
                Log::warning('TX SUCCESS TRANSITION — rejected; already refunded/terminal financial', [
                    'transaction_id' => $locked->id,
                    'source' => $source,
                    'provider_code' => $providerCode !== '' ? $providerCode : null,
                    'current_status' => $locked->status,
                    'refunded_at' => $locked->refunded_at?->toIso8601String(),
                    'attempted_action' => 'SET SUCCESS',
                    'sn' => $sn,
                ]);

                // Owner 2026-09-13 — never silent: late Digi/VIP SUCCESS after timeout refund
                // must surface to Finance/Ops/Owner for manual recon (tx 168 incident).
                $this->alertLateSuccessAfterRefund($locked, $source, $providerCode, $sn);

                return [
                    'outcome' => self::OUTCOME_REJECTED_REFUNDED,
                    'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']) ?? $locked,
                    'events_dispatched' => false,
                ];
            }

            if (! $this->isEligibleForFulfillmentSuccess($locked)) {
                Log::warning('TX SUCCESS TRANSITION — rejected; not in-flight', [
                    'transaction_id' => $locked->id,
                    'source' => $source,
                    'provider_code' => $providerCode !== '' ? $providerCode : null,
                    'current_status' => $locked->status,
                    'attempted_action' => 'SET SUCCESS',
                ]);

                return [
                    'outcome' => self::OUTCOME_REJECTED_NOT_INFLIGHT,
                    'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']) ?? $locked,
                    'events_dispatched' => false,
                ];
            }

            $historyProvider = $providerCode !== ''
                ? $providerCode
                : (string) ($locked->fulfillment_provider_code ?: 'provider');

            $locked->update([
                'status' => TransactionStatus::SUCCESS->value,
                'notes' => $notes,
                'provider_last_status' => 'success',
                'provider_checked_at' => now(),
                'completed_at' => now(),
                'provider_response' => is_array($providerResponse) ? $providerResponse : $locked->provider_response,
                'fulfillment_provider_code' => $locked->fulfillment_provider_code
                    ?: ($providerCode !== '' ? $providerCode : $locked->fulfillment_provider_code),
            ]);

            if ($syncDigiflazz && $historyProvider === ProductProvider::CODE_DIGIFLAZZ) {
                DigiflazzTransaction::where('transaction_id', $locked->id)->update(
                    DigiflazzService::digiflazzTransactionAttributesFromResponse(
                        'success',
                        $digiflazzResponse,
                        $sn
                    )
                );
            }

            PaymentHistory::recordFor(
                $locked,
                $historyProvider,
                'success',
                $raw,
                $rawItem,
                $locked->invoice_number
            );

            Log::info('TX SUCCESS TRANSITION — applied', [
                'transaction_id' => $locked->id,
                'source' => $source,
                'provider_code' => $historyProvider,
                'provider_ref' => $locked->provider_ref,
                'sn' => $sn,
            ]);

            $fresh = $locked->fresh(['user', 'paymentHistory', 'items']) ?? $locked;

            // Events only when transition actually applied (never on reject / already_success).
            event(new \App\Events\TransactionSuccess($fresh));
            event(new \App\Events\PaymentSettled($fresh, is_array($raw) ? $raw : []));

            return [
                'outcome' => self::OUTCOME_APPLIED,
                'transaction' => $fresh,
                'events_dispatched' => true,
            ];
        });
    }

    /**
     * Late provider SUCCESS after local FAILED+refund — Finance/Ops/Owner must reconcile.
     */
    protected function alertLateSuccessAfterRefund(
        Transaction $locked,
        string $source,
        string $providerCode,
        ?string $sn
    ): void {
        Log::critical('TX LATE SUCCESS AFTER REFUND — recon required', [
            'transaction_id' => $locked->id,
            'invoice' => $locked->invoice_number,
            'source' => $source,
            'provider_code' => $providerCode !== '' ? $providerCode : $locked->fulfillment_provider_code,
            'sn' => $sn,
            'refunded_at' => $locked->refunded_at?->toIso8601String(),
            'refund_reference' => $locked->refund_reference,
            'total_payment' => $locked->total_payment,
        ]);

        try {
            $exists = \App\Models\FinanceAlert::query()
                ->where('type', 'ppob_late_success_after_refund')
                ->where('related_type', 'transaction')
                ->where('related_id', (int) $locked->id)
                ->where('status', 'open')
                ->exists();
            $payload = [
                'transaction_id' => $locked->id,
                'invoice' => $locked->invoice_number,
                'source' => $source,
                'provider_code' => $providerCode !== '' ? $providerCode : $locked->fulfillment_provider_code,
                'sn' => $sn,
                'refunded_at' => optional($locked->refunded_at)->toDateTimeString(),
                'refund_reference' => $locked->refund_reference,
                'total_payment' => $locked->total_payment,
                'user_id' => $locked->user_id,
            ];
            $title = 'Late SUCCESS setelah refund: '.$locked->invoice_number;
            $body = 'Provider melaporkan SUKSES (SN: '.($sn ?? '-').') setelah transaksi sudah failed+refunded. '
                .'Periksa digiflazz_transactions vs wallet — kemungkinan perlu clawback rekonsiliasi.';

            if (! $exists) {
                \App\Models\FinanceAlert::query()->create([
                    'alert_code' => sprintf('ALT-LS-%s-%d', now()->format('YmdHis'), (int) $locked->id),
                    'type' => 'ppob_late_success_after_refund',
                    'severity' => 'critical',
                    'title' => $title,
                    'body' => $body,
                    'payload' => $payload,
                    'status' => 'open',
                    'related_type' => 'transaction',
                    'related_id' => (int) $locked->id,
                ]);
            }

            // Mirror to Ops Alert Center (Owner/Operations monitor path).
            app(\App\Services\Operations\OpsAlertService::class)->raiseOpen(
                'ppob_late_success_after_refund',
                'critical',
                $title,
                $body,
                $payload,
                'transaction',
                (int) $locked->id
            );
        } catch (\Throwable $e) {
            Log::error('TX LATE SUCCESS AFTER REFUND — alert raise failed', [
                'transaction_id' => $locked->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function isEligibleForFulfillmentSuccess(Transaction $locked): bool
    {
        return TransactionStatusMapper::isFulfillOpen($locked->status)
            || $locked->status === TransactionStatus::DRAFT->value;
    }
}
