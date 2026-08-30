<?php

namespace App\Services\Referral;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\CommissionLedger;
use App\Models\CommissionRule;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Wallet\WalletLedgerService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * SRS Bagian 31 — referral commission engine (independent from loyalty).
 * SUCCESS → PENDING → RELEASED (or REVERSED on pre-release refund).
 */
class ReferralCommissionService
{
    public function __construct(
        protected ReferralRelationService $relations,
        protected WalletLedgerService $walletLedger,
        protected ReferralFraudService $fraud
    ) {}

    public function currentRate(int $level): float
    {
        $rule = CommissionRule::query()
            ->where('level', $level)
            ->where('is_current', true)
            ->orderByDesc('id')
            ->first();

        if ($rule) {
            return (float) $rule->percentage;
        }

        return $level === 1
            ? (float) config('referral.level_1_percentage', 1.0)
            : (float) config('referral.level_2_percentage', 0.5);
    }

    public function isProductPurchaseEligible(Transaction $transaction): bool
    {
        if (! TransactionStatusMapper::isSuccess($transaction->status)) {
            return false;
        }

        if ($this->isPartnerApiTransaction($transaction)) {
            return false;
        }

        $paymentMethod = strtolower(trim((string) $transaction->payment_method));
        if ($paymentMethod !== 'wallet') {
            return false;
        }

        $service = strtolower((string) $transaction->service_name);
        foreach (['top up', 'topup', 'transfer saldo', 'transfer', 'penyesuaian', 'deposit', 'withdraw', 'redeem poin'] as $needle) {
            if (str_contains($service, $needle)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Bagian 30 exclusion — use available markers only (no H2H invent).
     */
    public function isPartnerApiTransaction(Transaction $transaction): bool
    {
        // Sprint 17 — canonical channel column (Bagian 30).
        if (($transaction->channel ?? null) === 'partner_api') {
            return true;
        }

        $resp = $transaction->provider_response;
        if (is_array($resp) && (($resp['channel'] ?? null) === 'partner_api' || ($resp['source'] ?? null) === 'partner_api')) {
            return true;
        }

        $notes = strtolower((string) ($transaction->notes ?? ''));
        if (str_contains($notes, 'partner_api')) {
            return true;
        }

        return false;
    }

    /**
     * @return array{created:int, skipped:bool}
     */
    public function awardForSuccessfulTransaction(Transaction $transaction): array
    {
        return DB::transaction(function () use ($transaction) {
            $lockedTx = Transaction::query()->where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            if (! $this->isProductPurchaseEligible($lockedTx)) {
                return ['created' => 0, 'skipped' => true];
            }

            $uplines = $this->relations->uplinesFor((int) $lockedTx->user_id);
            $pendingDays = (int) config('referral.pending_days', 3);
            $releaseAt = now()->addDays($pendingDays);
            $created = 0;
            $amount = (float) $lockedTx->amount;

            foreach ([1, 2] as $level) {
                $rel = $uplines[$level] ?? null;
                if (! $rel) {
                    continue;
                }

                $existing = CommissionLedger::query()
                    ->where('source_transaction_id', $lockedTx->id)
                    ->where('level', $level)
                    ->lockForUpdate()
                    ->first();
                if ($existing) {
                    continue;
                }

                $rate = $this->currentRate($level);
                $commission = round($amount * ($rate / 100), 2);
                if ($commission <= 0) {
                    continue;
                }

                CommissionLedger::query()->create([
                    'upline_user_id' => $rel->upline_user_id,
                    'downline_user_id' => $lockedTx->user_id,
                    'source_transaction_id' => $lockedTx->id,
                    'level' => $level,
                    'amount' => $commission,
                    'rate_percentage' => $rate,
                    'status' => CommissionLedger::STATUS_PENDING,
                    'release_at' => $releaseAt,
                ]);
                $created++;
            }

            return ['created' => $created, 'skipped' => $created === 0];
        });
    }

    /**
     * Pre-release refund → REVERSED.
     * Post-release → finance_review + fraud flag; NO wallet clawback.
     */
    public function handleSourceRefunded(Transaction $transaction): void
    {
        DB::transaction(function () use ($transaction) {
            $rows = CommissionLedger::query()
                ->where('source_transaction_id', $transaction->id)
                ->lockForUpdate()
                ->get();

            foreach ($rows as $row) {
                if ($row->status === CommissionLedger::STATUS_PENDING) {
                    $row->status = CommissionLedger::STATUS_REVERSED;
                    $row->reversed_at = now();
                    $row->save();
                    continue;
                }

                if ($row->status === CommissionLedger::STATUS_RELEASED) {
                    $row->status = CommissionLedger::STATUS_FINANCE_REVIEW;
                    $row->finance_review_reason = 'Source transaction refunded after commission RELEASED — manual Finance review; no auto clawback.';
                    $row->save();
                    $this->fraud->markFinanceReviewForReleasedRefund((int) $row->id, (int) $transaction->id, (int) $row->upline_user_id);
                }
            }
        });
    }

    /**
     * Release due pending commissions. Cap: if full amount would exceed remaining capacity, DEFER (leave pending).
     *
     * @return array{released:int, deferred_cap:int, reversed_ineligible:int}
     */
    public function releaseDue(?Carbon $now = null): array
    {
        $now = $now ?? now();
        $stats = ['released' => 0, 'deferred_cap' => 0, 'reversed_ineligible' => 0];

        $dueIds = CommissionLedger::query()
            ->where('status', CommissionLedger::STATUS_PENDING)
            ->where('release_at', '<=', $now)
            ->orderBy('id')
            ->limit(200)
            ->pluck('id');

        foreach ($dueIds as $id) {
            $result = $this->releaseOne((int) $id, $now);
            $stats[$result] = ($stats[$result] ?? 0) + 1;
        }

        return $stats;
    }

    /**
     * @return 'released'|'deferred_cap'|'reversed_ineligible'|'skipped'
     */
    public function releaseOne(int $ledgerId, ?Carbon $now = null): string
    {
        $now = $now ?? now();

        return DB::transaction(function () use ($ledgerId, $now) {
            $row = CommissionLedger::query()->where('id', $ledgerId)->lockForUpdate()->first();
            if (! $row || $row->status !== CommissionLedger::STATUS_PENDING) {
                return 'skipped';
            }

            $tx = Transaction::query()->where('id', $row->source_transaction_id)->lockForUpdate()->first();
            $statusRaw = (string) ($tx->status ?? '');
            if (! $tx || ! TransactionStatusMapper::isSuccess($statusRaw) || $tx->refunded_at) {
                $row->status = CommissionLedger::STATUS_REVERSED;
                $row->reversed_at = $now;
                $row->save();

                return 'reversed_ineligible';
            }

            $amount = (float) $row->amount;
            $tz = config('referral.timezone', config('app.timezone', 'Asia/Jakarta'));
            $dayStart = $now->copy()->timezone($tz)->startOfDay()->timezone(config('app.timezone'));
            $dayEnd = $now->copy()->timezone($tz)->endOfDay()->timezone(config('app.timezone'));
            $monthStart = $now->copy()->timezone($tz)->startOfMonth()->timezone(config('app.timezone'));
            $monthEnd = $now->copy()->timezone($tz)->endOfMonth()->timezone(config('app.timezone'));

            // Lock upline wallet early to serialize concurrent releases for same user.
            $wallet = Wallet::query()->where('user_id', $row->upline_user_id)->lockForUpdate()->first();
            if (! $wallet) {
                return 'skipped';
            }

            $dailyReleased = (float) CommissionLedger::query()
                ->where('upline_user_id', $row->upline_user_id)
                ->where('status', CommissionLedger::STATUS_RELEASED)
                ->whereBetween('released_at', [$dayStart, $dayEnd])
                ->sum('amount');

            $monthlyReleased = (float) CommissionLedger::query()
                ->where('upline_user_id', $row->upline_user_id)
                ->where('status', CommissionLedger::STATUS_RELEASED)
                ->whereBetween('released_at', [$monthStart, $monthEnd])
                ->sum('amount');

            $dailyCap = (float) config('referral.daily_cap', 1_000_000);
            $monthlyCap = (float) config('referral.monthly_cap', 10_000_000);

            if (($dailyReleased + $amount) > $dailyCap + 0.00001 || ($monthlyReleased + $amount) > $monthlyCap + 0.00001) {
                // Deterministic: defer full amount (no partial invent). Leave PENDING.
                return 'deferred_cap';
            }

            $wallet->balance = (float) $wallet->balance + $amount;
            $wallet->save();

            $mutation = $this->walletLedger->record(
                $wallet,
                WalletMutation::TYPE_REFERRAL_COMMISSION,
                $amount,
                'credit',
                'Referral commission L'.$row->level.' TX#'.$row->source_transaction_id,
                'commission_ledger:'.$row->id
            );

            $row->status = CommissionLedger::STATUS_RELEASED;
            $row->released_at = $now;
            $row->wallet_mutation_id = $mutation->id;
            $row->save();

            ActivityLog::create([
                'user_id' => $row->upline_user_id,
                'activity' => 'REFERRAL_COMMISSION_RELEASED',
                'payload' => [
                    'commission_ledger_id' => $row->id,
                    'amount' => $amount,
                    'wallet_mutation_id' => $mutation->id,
                ],
            ]);

            return 'released';
        });
    }

    public function upsertRule(User $actor, int $level, float $percentage, string $reason): CommissionRule
    {
        if (! $this->actorMayManageRules($actor)) {
            throw ValidationException::withMessages(['role' => ['Hanya Finance yang dapat mengelola commission_rules.']]);
        }
        if (! in_array($level, [1, 2], true)) {
            throw ValidationException::withMessages(['level' => ['Level harus 1 atau 2.']]);
        }
        if ($percentage < 0 || $percentage > 100) {
            throw ValidationException::withMessages(['percentage' => ['Persentase tidak valid.']]);
        }

        return DB::transaction(function () use ($actor, $level, $percentage, $reason) {
            CommissionRule::query()
                ->where('level', $level)
                ->where('is_current', true)
                ->update(['is_current' => false]);

            $rule = CommissionRule::query()->create([
                'level' => $level,
                'percentage' => $percentage,
                'effective_from' => now(),
                'is_current' => true,
                'updated_by' => $actor->id,
                'reason' => $reason,
            ]);

            ActivityLog::create([
                'user_id' => $actor->id,
                'activity' => 'COMMISSION_RULE_UPDATED',
                'payload' => [
                    'level' => $level,
                    'percentage' => $percentage,
                    'reason' => $reason,
                    'rule_id' => $rule->id,
                ],
            ]);

            return $rule;
        });
    }

    public function actorMayManageRules(User $actor): bool
    {
        $role = $actor->role instanceof UserRole ? $actor->role : UserRole::tryFrom((string) $actor->role);

        return $role === UserRole::FINANCE || $role === UserRole::SUPER_ADMIN;
    }

    public function actorMayViewFinance(User $actor): bool
    {
        $role = $actor->role instanceof UserRole ? $actor->role : UserRole::tryFrom((string) $actor->role);

        return in_array($role, [
            UserRole::FINANCE,
            UserRole::OWNER,
            UserRole::SUPER_ADMIN,
            UserRole::CUSTOMER_SUPPORT,
        ], true);
    }

    public function userSummary(User $user): array
    {
        $code = app(ReferralCodeService::class)->ensureForUser($user);
        $l1 = \App\Models\ReferralRelation::query()->where('upline_user_id', $user->id)->where('level', 1)->count();
        $l2 = \App\Models\ReferralRelation::query()->where('upline_user_id', $user->id)->where('level', 2)->count();

        $agg = CommissionLedger::query()
            ->where('upline_user_id', $user->id)
            ->selectRaw('status, SUM(amount) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'code' => $code->code,
            'is_custom' => $code->is_custom,
            'direct_referrals' => $l1,
            'level_1_count' => $l1,
            'level_2_count' => $l2,
            'pending_total' => (float) ($agg[CommissionLedger::STATUS_PENDING] ?? 0),
            'released_total' => (float) ($agg[CommissionLedger::STATUS_RELEASED] ?? 0),
            'reversed_total' => (float) ($agg[CommissionLedger::STATUS_REVERSED] ?? 0),
            'finance_review_total' => (float) ($agg[CommissionLedger::STATUS_FINANCE_REVIEW] ?? 0),
        ];
    }

    public function userDownlines(User $user, int $perPage = 20)
    {
        return \App\Models\ReferralRelation::query()
            ->where('upline_user_id', $user->id)
            ->with(['downline:id,name,created_at'])
            ->orderByDesc('id')
            ->paginate(min(50, max(1, $perPage)))
            ->through(function ($row) {
                return [
                    'name' => $row->downline?->name ?? '—',
                    'level' => (int) $row->level,
                    'joined_at' => optional($row->downline?->created_at)->toIso8601String(),
                ];
            });
    }

    public function capUsage(User $upline, ?Carbon $now = null): array
    {
        $now = $now ?? now();
        $tz = config('referral.timezone', 'Asia/Jakarta');
        $dayStart = $now->copy()->timezone($tz)->startOfDay();
        $dayEnd = $now->copy()->timezone($tz)->endOfDay();
        $monthStart = $now->copy()->timezone($tz)->startOfMonth();
        $monthEnd = $now->copy()->timezone($tz)->endOfMonth();

        $daily = (float) CommissionLedger::query()
            ->where('upline_user_id', $upline->id)
            ->where('status', CommissionLedger::STATUS_RELEASED)
            ->whereBetween('released_at', [$dayStart, $dayEnd])
            ->sum('amount');
        $monthly = (float) CommissionLedger::query()
            ->where('upline_user_id', $upline->id)
            ->where('status', CommissionLedger::STATUS_RELEASED)
            ->whereBetween('released_at', [$monthStart, $monthEnd])
            ->sum('amount');

        return [
            'daily_released' => $daily,
            'daily_cap' => (float) config('referral.daily_cap'),
            'daily_remaining' => max(0, (float) config('referral.daily_cap') - $daily),
            'monthly_released' => $monthly,
            'monthly_cap' => (float) config('referral.monthly_cap'),
            'monthly_remaining' => max(0, (float) config('referral.monthly_cap') - $monthly),
            'timezone' => $tz,
        ];
    }
}
