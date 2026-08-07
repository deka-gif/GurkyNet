<?php

namespace App\Services\Finance;

use App\Contracts\Realtime\RealtimeTransport;
use App\Models\ActivityLog;
use App\Models\DivisionNotification;
use App\Models\FinanceSettlement;
use App\Models\User;
use App\Models\Workflow;
use App\Services\Workflow\WorkflowEngineService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceSettlementService
{
    public function __construct(
        protected WorkflowEngineService $workflows,
        protected FinanceLedgerService $ledger,
        protected RealtimeTransport $realtime
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $actor, array $data): FinanceSettlement
    {
        $amount = (float) ($data['amount'] ?? 0);
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'Nominal settlement harus > 0.']);
        }

        $gateway = strtolower((string) ($data['gateway'] ?? 'midtrans'));

        return DB::transaction(function () use ($actor, $data, $amount, $gateway) {
            $settlement = FinanceSettlement::create([
                'settlement_code' => $this->nextCode(),
                'gateway' => $gateway,
                'provider' => $data['provider'] ?? null,
                'batch_number' => $data['batch_number'] ?? $data['batchNumber'] ?? null,
                'settlement_reference' => $data['settlement_reference'] ?? $data['settlementReference'] ?? null,
                'amount' => $amount,
                'currency' => $data['currency'] ?? 'IDR',
                'status' => 'pending',
                'notes' => $data['notes'] ?? null,
                'evidence' => $data['evidence'] ?? null,
                'created_by' => $actor->id,
            ]);

            $workflow = $this->workflows->create($actor, [
                'source' => 'manual',
                'category' => 'settlement_batch',
                'current_division' => 'finance',
                'status' => Workflow::waitingStatusForDivision('finance'),
                'priority' => 'medium',
                'title' => 'Settlement '.$settlement->settlement_code,
                'description' => $settlement->notes ?: ('Settlement '.$gateway.' amount '.$amount),
                'meta' => [
                    'settlement_id' => $settlement->id,
                    'settlement_code' => $settlement->settlement_code,
                ],
            ]);

            $settlement->update(['workflow_id' => $workflow->id]);

            ActivityLog::create([
                'user_id' => $actor->id,
                'activity' => 'FINANCE_SETTLEMENT_CREATED',
                'payload' => [
                    'settlement_id' => $settlement->id,
                    'workflow_id' => $workflow->id,
                    'amount' => $amount,
                ],
            ]);

            DivisionNotification::create([
                'role' => 'finance',
                'type' => 'settlement_new',
                'title' => 'Settlement baru: '.$settlement->settlement_code,
                'body' => $settlement->notes,
                'payload' => ['settlement_id' => $settlement->id],
                'related_type' => 'finance_settlement',
                'related_id' => $settlement->id,
            ]);

            $this->realtime->publish('division.finance', 'SettlementCreated', $this->payload($settlement->fresh()));

            return $settlement->fresh(['creator', 'reviewer', 'workflow']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(FinanceSettlement $settlement, User $actor, array $data): FinanceSettlement
    {
        if (isset($data['status'])) {
            $to = (string) $data['status'];
            if (! in_array($to, FinanceSettlement::STATUSES, true)) {
                throw ValidationException::withMessages(['status' => 'Status settlement tidak valid.']);
            }
            $this->assertTransition($settlement->status, $to);
            $settlement->status = $to;
            if (in_array($to, ['completed', 'cancelled', 'failed'], true)) {
                $settlement->completed_at = now();
            }
        }

        if (array_key_exists('notes', $data)) {
            $settlement->notes = $data['notes'];
        }
        if (array_key_exists('evidence', $data) && is_array($data['evidence'])) {
            $settlement->evidence = array_merge($settlement->evidence ?? [], $data['evidence']);
        }
        if (array_key_exists('settlement_reference', $data) || array_key_exists('settlementReference', $data)) {
            $settlement->settlement_reference = $data['settlement_reference'] ?? $data['settlementReference'];
        }
        if (array_key_exists('batch_number', $data) || array_key_exists('batchNumber', $data)) {
            $settlement->batch_number = $data['batch_number'] ?? $data['batchNumber'];
        }

        $settlement->reviewed_by = $actor->id;
        $settlement->save();

        if ($settlement->workflow_id) {
            $wf = Workflow::query()->find($settlement->workflow_id);
            if ($wf) {
                $this->workflows->recordAction(
                    $wf,
                    $actor,
                    'settlement_'.$settlement->status,
                    'Settlement '.$settlement->settlement_code.' → '.$settlement->status,
                    ['settlement_id' => $settlement->id, 'status' => $settlement->status]
                );

                if ($settlement->status === 'completed') {
                    $this->workflows->transitionStatus($wf, $actor, 'resolved', 'Settlement completed', 'resolved', 'settlement_completed');
                } elseif (in_array($settlement->status, ['cancelled', 'failed'], true)) {
                    $this->workflows->transitionStatus($wf, $actor, 'rejected', 'Settlement '.$settlement->status, 'resolved', 'settlement_'.$settlement->status);
                }
            }
        }

        if ($settlement->status === 'completed') {
            $this->ledger->record([
                'workflow_id' => $settlement->workflow_id,
                'source_module' => 'settlement',
                'event_type' => 'settlement',
                'debit' => 0,
                'credit' => (float) $settlement->amount,
                'reference' => $settlement->settlement_code,
                'created_by' => $actor->id,
                'meta' => [
                    'settlement_id' => $settlement->id,
                    'gateway' => $settlement->gateway,
                    'no_auto_payout' => true,
                ],
            ], $actor);

            DivisionNotification::create([
                'role' => 'customer_support',
                'type' => 'settlement_completed',
                'title' => 'Settlement selesai: '.$settlement->settlement_code,
                'body' => 'Amount '.number_format((float) $settlement->amount, 0, ',', '.'),
                'payload' => ['settlement_id' => $settlement->id],
                'related_type' => 'finance_settlement',
                'related_id' => $settlement->id,
            ]);
            DivisionNotification::create([
                'role' => 'operations',
                'type' => 'settlement_completed',
                'title' => 'Settlement selesai: '.$settlement->settlement_code,
                'body' => $settlement->provider ?: $settlement->gateway,
                'payload' => ['settlement_id' => $settlement->id],
                'related_type' => 'finance_settlement',
                'related_id' => $settlement->id,
            ]);
        }

        ActivityLog::create([
            'user_id' => $actor->id,
            'activity' => 'FINANCE_SETTLEMENT_UPDATED',
            'payload' => [
                'settlement_id' => $settlement->id,
                'status' => $settlement->status,
            ],
        ]);

        $this->realtime->publish('division.finance', 'SettlementUpdated', $this->payload($settlement->fresh(['creator', 'reviewer', 'workflow'])));

        return $settlement->fresh(['creator', 'reviewer', 'workflow']);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator
    {
        $q = FinanceSettlement::query()
            ->with(['creator:id,name', 'reviewer:id,name', 'workflow:id,workflow_code,status'])
            ->orderByDesc('id');

        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['gateway'])) {
            $q->where('gateway', $filters['gateway']);
        }
        if (! empty($filters['q'])) {
            $term = $filters['q'];
            $q->where(function ($b) use ($term) {
                $b->where('settlement_code', 'like', '%'.$term.'%')
                    ->orWhere('batch_number', 'like', '%'.$term.'%')
                    ->orWhere('settlement_reference', 'like', '%'.$term.'%');
            });
        }

        return $q->paginate(max(1, min(100, (int) ($filters['per_page'] ?? 30))));
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(FinanceSettlement $s): array
    {
        return [
            'id' => $s->id,
            'settlementCode' => $s->settlement_code,
            'workflowId' => $s->workflow_id,
            'workflowCode' => $s->workflow?->workflow_code,
            'gateway' => $s->gateway,
            'provider' => $s->provider,
            'batchNumber' => $s->batch_number,
            'settlementReference' => $s->settlement_reference,
            'amount' => (float) $s->amount,
            'currency' => $s->currency,
            'status' => $s->status,
            'notes' => $s->notes,
            'evidence' => $s->evidence,
            'createdBy' => $s->created_by,
            'createdByName' => $s->creator?->name,
            'reviewedBy' => $s->reviewed_by,
            'reviewedByName' => $s->reviewer?->name,
            'completedAt' => optional($s->completed_at)?->toIso8601String(),
            'createdAt' => optional($s->created_at)?->toIso8601String(),
            'updatedAt' => optional($s->updated_at)?->toIso8601String(),
            'autoPayout' => false,
        ];
    }

    protected function assertTransition(string $from, string $to): void
    {
        if ($from === $to) {
            return;
        }

        $allowed = [
            'pending' => ['processing', 'cancelled', 'failed'],
            'processing' => ['completed', 'cancelled', 'failed', 'pending'],
            'completed' => [],
            'cancelled' => [],
            'failed' => ['pending'],
        ];

        if (! in_array($to, $allowed[$from] ?? [], true)) {
            throw ValidationException::withMessages([
                'status' => "Transisi status {$from} → {$to} tidak diizinkan.",
            ]);
        }
    }

    protected function nextCode(): string
    {
        $date = now()->format('Ymd');
        $seq = FinanceSettlement::withTrashed()->whereDate('created_at', today())->count() + 1;

        return sprintf('STL-%s-%04d', $date, $seq);
    }
}
