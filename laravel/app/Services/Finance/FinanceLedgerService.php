<?php

namespace App\Services\Finance;

use App\Models\ActivityLog;
use App\Models\FinanceLedgerEntry;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;

/**
 * Append-only finance journal. No update/delete methods by design.
 */
class FinanceLedgerService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function record(array $data, ?User $actor = null): FinanceLedgerEntry
    {
        $actor = $actor ?? Auth::user();

        $entry = FinanceLedgerEntry::create([
            'ledger_code' => $this->nextCode(),
            'workflow_id' => $data['workflow_id'] ?? $data['workflowId'] ?? null,
            'user_id' => $data['user_id'] ?? $data['userId'] ?? null,
            'transaction_id' => $data['transaction_id'] ?? $data['transactionId'] ?? null,
            'payment_history_id' => $data['payment_history_id'] ?? $data['paymentHistoryId'] ?? null,
            'wallet_history_id' => $data['wallet_history_id'] ?? $data['walletHistoryId'] ?? null,
            'invoice' => $data['invoice'] ?? null,
            'source_module' => $data['source_module'] ?? $data['sourceModule'] ?? 'system',
            'event_type' => $data['event_type'] ?? $data['eventType'] ?? 'unknown',
            'debit' => (float) ($data['debit'] ?? 0),
            'credit' => (float) ($data['credit'] ?? 0),
            'balance_snapshot' => $data['balance_snapshot'] ?? $data['balanceSnapshot'] ?? null,
            'currency' => $data['currency'] ?? 'IDR',
            'reference' => $data['reference'] ?? null,
            'created_by' => $data['created_by'] ?? $data['createdBy'] ?? $actor?->id,
            'meta' => is_array($data['meta'] ?? null) ? $data['meta'] : [],
        ]);

        ActivityLog::create([
            'user_id' => $actor?->id,
            'activity' => 'LEDGER_ENTRY_RECORDED',
            'payload' => [
                'ledger_id' => $entry->id,
                'ledger_code' => $entry->ledger_code,
                'event_type' => $entry->event_type,
                'debit' => $entry->debit,
                'credit' => $entry->credit,
            ],
        ]);

        return $entry;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator
    {
        $q = FinanceLedgerEntry::query()
            ->with(['user:id,name,email', 'creator:id,name', 'transaction:id,invoice_number,status'])
            ->orderByDesc('id');

        if (! empty($filters['event_type'])) {
            $q->where('event_type', $filters['event_type']);
        }
        if (! empty($filters['source_module'])) {
            $q->where('source_module', $filters['source_module']);
        }
        if (! empty($filters['user_id'])) {
            $q->where('user_id', $filters['user_id']);
        }
        if (! empty($filters['transaction_id'])) {
            $q->where('transaction_id', $filters['transaction_id']);
        }
        if (! empty($filters['workflow_id'])) {
            $q->where('workflow_id', $filters['workflow_id']);
        }
        if (! empty($filters['q'])) {
            $term = $filters['q'];
            $q->where(function ($b) use ($term) {
                $b->where('ledger_code', 'like', '%'.$term.'%')
                    ->orWhere('invoice', 'like', '%'.$term.'%')
                    ->orWhere('reference', 'like', '%'.$term.'%');
            });
        }
        if (! empty($filters['start_date'])) {
            $q->whereDate('created_at', '>=', $filters['start_date']);
        }
        if (! empty($filters['end_date'])) {
            $q->whereDate('created_at', '<=', $filters['end_date']);
        }

        $perPage = (int) ($filters['per_page'] ?? 30);

        return $q->paginate(max(1, min(100, $perPage)));
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(FinanceLedgerEntry $e): array
    {
        return [
            'id' => $e->id,
            'ledgerCode' => $e->ledger_code,
            'workflowId' => $e->workflow_id,
            'userId' => $e->user_id,
            'userName' => $e->user?->name,
            'transactionId' => $e->transaction_id,
            'invoice' => $e->invoice,
            'sourceModule' => $e->source_module,
            'eventType' => $e->event_type,
            'debit' => (float) $e->debit,
            'credit' => (float) $e->credit,
            'balanceSnapshot' => $e->balance_snapshot !== null ? (float) $e->balance_snapshot : null,
            'currency' => $e->currency,
            'reference' => $e->reference,
            'createdBy' => $e->created_by,
            'createdByName' => $e->creator?->name,
            'meta' => $e->meta,
            'createdAt' => optional($e->created_at)?->toIso8601String(),
        ];
    }

    protected function nextCode(): string
    {
        $date = now()->format('Ymd');
        $seq = FinanceLedgerEntry::query()->whereDate('created_at', today())->count() + 1;

        return sprintf('LED-%s-%04d', $date, $seq);
    }
}
