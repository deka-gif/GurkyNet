<?php

namespace App\Services\Finance;

use App\Enums\TransactionStatus;
use App\Models\FinanceSettlement;
use App\Models\PaymentHistory;
use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Services\Payment\PaymentGatewayControlService;
use App\Services\ProductProviders\ProductProviderControlService;
use Illuminate\Support\Facades\DB;

class FinanceTreasuryService
{
    public function __construct(
        protected PaymentGatewayControlService $gateways,
        protected ProductProviderControlService $providers
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $walletLiability = (float) Wallet::query()->sum('balance');
        $frozenWallets = (int) Wallet::query()->whereIn('status', ['frozen', 'locked', 'inactive'])->count();

        $providerDeposits = ProductProvider::query()->get()->map(function (ProductProvider $p) {
            return [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'balance' => $p->balance !== null ? (float) $p->balance : null,
                'partnerStatus' => $p->partner_status,
                'isActive' => (bool) $p->is_active,
                'lastHealthCheckAt' => optional($p->last_health_check_at)?->toIso8601String(),
            ];
        })->values()->all();

        $providerDepositTotal = collect($providerDeposits)->sum(fn ($r) => (float) ($r['balance'] ?? 0));

        $pendingSettlements = FinanceSettlement::query()->whereIn('status', ['pending', 'processing'])->get();
        $pendingSettlementAmount = (float) $pendingSettlements->sum('amount');

        $paymentVolumeToday = (float) PaymentHistory::query()
            ->whereDate('created_at', today())
            ->whereIn('status', ['success', 'settlement', 'capture', 'paid'])
            ->sum(DB::raw('COALESCE(JSON_EXTRACT(payload, "$.amount"), 0)'));

        // SQLite-safe fallback: sum via collection if JSON extract fails on sqlite
        if ($paymentVolumeToday <= 0) {
            $paymentVolumeToday = (float) Transaction::query()
                ->whereDate('created_at', today())
                ->where('payment_method', 'like', '%midtrans%')
                ->orWhere(function ($q) {
                    $q->whereDate('created_at', today())->where('service_name', 'like', '%Top%');
                })
                ->sum('total_payment');
        }

        $gateways = collect($this->gateways->listControlCenter())->map(function (array $gw) {
            return [
                'code' => $gw['code'] ?? null,
                'name' => $gw['name'] ?? null,
                'status' => $gw['status'] ?? $gw['partner_status'] ?? null,
                'balance' => $gw['balance'] ?? null, // Midtrans typically null
                'configured' => $gw['configured'] ?? $gw['is_configured'] ?? null,
            ];
        })->values()->all();

        return [
            'availableCashProxy' => $providerDepositTotal, // internal deposits — not bank scrape
            'walletLiability' => $walletLiability,
            'frozenWallets' => $frozenWallets,
            'providerDepositTotal' => $providerDepositTotal,
            'providerDeposits' => $providerDeposits,
            'pendingSettlementCount' => $pendingSettlements->count(),
            'pendingSettlementAmount' => $pendingSettlementAmount,
            'paymentGateways' => $gateways,
            'bank' => null, // no bank API in sprint
            'cashFlowToday' => [
                'inflow' => (float) Transaction::query()
                    ->whereDate('created_at', today())
                    ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success'])
                    ->where(function ($q) {
                        $q->where('service_name', 'like', '%Top%')
                            ->orWhere('payment_method', 'adjustment');
                    })
                    ->sum('total_payment'),
                'outflowRefunds' => (float) Transaction::query()
                    ->whereDate('refunded_at', today())
                    ->sum('total_payment'),
                'settlementsCompleted' => (float) FinanceSettlement::query()
                    ->where('status', 'completed')
                    ->whereDate('completed_at', today())
                    ->sum('amount'),
            ],
        ];
    }

    /**
     * Refresh provider balances via existing Ops health checks (no scrape).
     *
     * @return list<array<string, mixed>>
     */
    public function refreshProviderDeposits(): array
    {
        $rows = [];
        foreach (ProductProvider::query()->get() as $provider) {
            try {
                $result = $this->providers->healthCheck($provider);
                $provider->refresh();
                $rows[] = [
                    'id' => $provider->id,
                    'code' => $provider->code,
                    'name' => $provider->name,
                    'balance' => $provider->balance !== null ? (float) $provider->balance : null,
                    'health' => $result,
                ];
            } catch (\Throwable $e) {
                $rows[] = [
                    'id' => $provider->id,
                    'code' => $provider->code,
                    'name' => $provider->name,
                    'balance' => $provider->balance !== null ? (float) $provider->balance : null,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $rows;
    }
}
