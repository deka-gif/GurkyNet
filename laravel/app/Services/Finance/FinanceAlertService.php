<?php

namespace App\Services\Finance;

use App\Contracts\Realtime\RealtimeTransport;
use App\Enums\TransactionStatus;
use App\Models\DivisionNotification;
use App\Models\FinanceAlert;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceSettlement;
use App\Models\ProductProvider;
use App\Models\TransactionItem;
use App\Services\Payment\PaymentGatewayControlService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class FinanceAlertService
{
    public function __construct(
        protected RealtimeTransport $realtime,
        protected PaymentGatewayControlService $gateways
    ) {}

    /**
     * @return list<FinanceAlert>
     */
    public function evaluate(): array
    {
        $created = [];
        $minDeposit = (float) env('FINANCE_PROVIDER_DEPOSIT_MIN', 5_000_000);
        $largeRefund = (float) env('FINANCE_LARGE_REFUND_THRESHOLD', 1_000_000);

        foreach (ProductProvider::query()->get() as $provider) {
            $balance = $provider->balance !== null ? (float) $provider->balance : null;
            if ($balance !== null && $balance < $minDeposit) {
                $alert = $this->upsertOpen(
                    'low_provider_deposit',
                    'critical',
                    'Low provider deposit: '.$provider->name,
                    'Saldo '.$provider->code.' Rp '.number_format($balance, 0, ',', '.').' di bawah threshold.',
                    ['provider_id' => $provider->id, 'balance' => $balance, 'threshold' => $minDeposit],
                    'product_provider',
                    $provider->id,
                    ['finance', 'operations', 'owner']
                );
                if ($alert) {
                    $created[] = $alert;
                }
            }
        }

        foreach ($this->gateways->listControlCenter() as $gw) {
            $status = strtolower((string) ($gw['status'] ?? $gw['partner_status'] ?? 'unknown'));
            if (in_array($status, ['offline', 'error', 'down'], true)) {
                $alert = $this->upsertOpen(
                    'gateway_offline',
                    'critical',
                    'Gateway offline: '.($gw['name'] ?? $gw['code'] ?? 'unknown'),
                    'Payment gateway status: '.$status,
                    ['gateway' => $gw],
                    'payment_gateway',
                    null,
                    ['finance', 'operations']
                );
                if ($alert) {
                    $created[] = $alert;
                }
            }
        }

        foreach (
            FinanceSettlement::query()
                ->whereIn('status', ['pending', 'processing'])
                ->where('created_at', '<', now()->subHours(24))
                ->get() as $s
        ) {
            $alert = $this->upsertOpen(
                'settlement_delay',
                'warning',
                'Settlement delay: '.$s->settlement_code,
                'Settlement masih '.$s->status.' > 24 jam.',
                ['settlement_id' => $s->id],
                'finance_settlement',
                $s->id,
                ['finance', 'operations']
            );
            if ($alert) {
                $created[] = $alert;
            }
        }

        $todayRefunds = FinanceLedgerEntry::query()
            ->whereIn('event_type', ['wallet_refund', 'refund_approve'])
            ->whereDate('created_at', today())
            ->get();

        foreach ($todayRefunds as $entry) {
            if ((float) $entry->credit >= $largeRefund) {
                $alert = $this->upsertOpen(
                    'large_refund',
                    'warning',
                    'Large refund: '.$entry->ledger_code,
                    'Refund Rp '.number_format((float) $entry->credit, 0, ',', '.'),
                    ['ledger_id' => $entry->id, 'amount' => (float) $entry->credit],
                    'finance_ledger_entry',
                    $entry->id,
                    ['finance', 'customer_support']
                );
                if ($alert) {
                    $created[] = $alert;
                }
            }
        }

        $todayCount = $todayRefunds->count();
        $avg7 = FinanceLedgerEntry::query()
            ->whereIn('event_type', ['wallet_refund', 'refund_approve'])
            ->where('created_at', '>=', now()->subDays(7))
            ->where('created_at', '<', today())
            ->count() / 7;
        if ($avg7 > 0 && $todayCount > ($avg7 * 2)) {
            $alert = $this->upsertOpen(
                'refund_spike',
                'critical',
                'Refund spike detected',
                "Refund hari ini {$todayCount} vs rata-rata 7 hari ".round($avg7, 1),
                ['today' => $todayCount, 'avg7' => $avg7],
                null,
                null,
                ['finance', 'customer_support', 'owner']
            );
            if ($alert) {
                $created[] = $alert;
            }
        }

        $items = TransactionItem::query()
            ->whereHas('transaction', function ($q) {
                $q->whereDate('created_at', today())
                    ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success']);
            })
            ->get();
        $marginToday = (float) $items->sum(function (TransactionItem $item) {
            $meta = is_array($item->custom_metadata ?? null) ? $item->custom_metadata : (is_string($item->custom_metadata ?? null) ? (json_decode($item->custom_metadata, true) ?: []) : []);
            $base = (float) ($meta['base_price'] ?? $meta['provider_price'] ?? 0);
            $sell = (float) ($item->price ?? $item->subtotal ?? $item->amount ?? 0);

            return $sell > 0 && $base > 0 ? ($sell - $base) : 0;
        });
        if ($marginToday < 0) {
            $alert = $this->upsertOpen(
                'negative_margin',
                'warning',
                'Negative margin today',
                'Estimasi margin hari ini Rp '.number_format($marginToday, 0, ',', '.'),
                ['margin' => $marginToday],
                null,
                null,
                ['finance', 'marketing', 'operations']
            );
            if ($alert) {
                $created[] = $alert;
            }
        }

        return $created;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $roles
     */
    protected function upsertOpen(
        string $type,
        string $severity,
        string $title,
        string $body,
        array $payload,
        ?string $relatedType,
        ?int $relatedId,
        array $roles
    ): ?FinanceAlert {
        $q = FinanceAlert::query()->where('type', $type)->where('status', 'open');
        if ($relatedType && $relatedId) {
            $q->where('related_type', $relatedType)->where('related_id', $relatedId);
        } else {
            $q->whereDate('created_at', today())->whereNull('related_id');
        }
        $existing = $q->first();
        if ($existing) {
            $existing->update([
                'severity' => $severity,
                'title' => $title,
                'body' => $body,
                'payload' => $payload,
            ]);

            return null;
        }

        $alert = FinanceAlert::create([
            'alert_code' => sprintf('ALT-%s-%04d', now()->format('Ymd'), FinanceAlert::query()->whereDate('created_at', today())->count() + 1),
            'type' => $type,
            'severity' => $severity,
            'title' => $title,
            'body' => $body,
            'payload' => $payload,
            'status' => 'open',
            'related_type' => $relatedType,
            'related_id' => $relatedId,
        ]);

        foreach ($roles as $role) {
            DivisionNotification::create([
                'role' => $role,
                'type' => 'finance_alert',
                'title' => $title,
                'body' => $body,
                'payload' => ['alert_id' => $alert->id, 'severity' => $severity],
                'related_type' => 'finance_alert',
                'related_id' => $alert->id,
            ]);
            if (in_array($role, ['finance', 'operations', 'customer_support', 'marketing'], true)) {
                $this->realtime->publish('division.'.$role, 'FinanceAlertCreated', [
                    'id' => $alert->id,
                    'type' => $type,
                    'severity' => $severity,
                    'title' => $title,
                ]);
            }
        }

        return $alert;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator
    {
        $q = FinanceAlert::query()
            ->orderByRaw("CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END")
            ->orderByDesc('id');

        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['severity'])) {
            $q->where('severity', $filters['severity']);
        }
        if (! empty($filters['type'])) {
            $q->where('type', $filters['type']);
        }

        return $q->paginate(max(1, min(100, (int) ($filters['per_page'] ?? 30))));
    }

    public function acknowledge(FinanceAlert $alert): FinanceAlert
    {
        $alert->update(['status' => 'acknowledged', 'read_at' => now()]);

        return $alert->fresh();
    }

    public function resolve(FinanceAlert $alert): FinanceAlert
    {
        $alert->update(['status' => 'resolved', 'resolved_at' => now(), 'read_at' => $alert->read_at ?: now()]);

        return $alert->fresh();
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(FinanceAlert $a): array
    {
        return [
            'id' => $a->id,
            'alertCode' => $a->alert_code,
            'type' => $a->type,
            'severity' => $a->severity,
            'title' => $a->title,
            'body' => $a->body,
            'payload' => $a->payload,
            'status' => $a->status,
            'relatedType' => $a->related_type,
            'relatedId' => $a->related_id,
            'createdAt' => optional($a->created_at)?->toIso8601String(),
            'resolvedAt' => optional($a->resolved_at)?->toIso8601String(),
        ];
    }
}
