<?php

namespace App\Services\Loyalty;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\LoyaltyPoint;
use App\Models\LoyaltyPointLedger;
use App\Models\LoyaltyTier;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Wallet\WalletLedgerService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * FR-DIFF-01 / FR-DIFF-08 — centralized loyalty points + tier engine.
 * Locked Sprint 14 decisions: 10k→100 pts, floor, SUCCESS purchase only, 1pt=Rp1, expiry 12mo.
 */
class LoyaltyPointService
{
    public const MIN_EARN_AMOUNT = 10000;

    public const POINTS_PER_BLOCK = 100;

    public const AMOUNT_BLOCK = 10000;

    public const MIN_REDEEM = 100;

    public const EXPIRY_MONTHS = 12;

    public function __construct(
        protected WalletLedgerService $walletLedger
    ) {}

    public function calculateEarnPoints(float $amount): int
    {
        if ($amount < self::MIN_EARN_AMOUNT) {
            return 0;
        }

        return (int) (floor($amount / self::AMOUNT_BLOCK) * self::POINTS_PER_BLOCK);
    }

    public function isProductPurchaseEligible(Transaction $transaction): bool
    {
        if (! TransactionStatusMapper::isSuccess($transaction->status)) {
            return false;
        }

        // Sprint 17 / SRS 30 — partner H2H is not loyalty-eligible.
        if (($transaction->channel ?? null) === 'partner_api'
            || strtolower((string) $transaction->payment_method) === 'partner_wallet') {
            return false;
        }

        $paymentMethod = strtolower(trim((string) $transaction->payment_method));
        $excludedMethods = [
            'adjustment',
            'transfer',
            'midtrans',
            'deposit',
            'manual_deposit',
            'dummy_gateway',
            'qris',
            'bank_transfer',
            'va',
        ];
        if (in_array($paymentMethod, $excludedMethods, true)) {
            return false;
        }

        $service = strtolower((string) $transaction->service_name);
        foreach (['top up', 'topup', 'transfer saldo', 'penyesuaian', 'deposit', 'withdraw'] as $needle) {
            if (str_contains($service, $needle)) {
                return false;
            }
        }

        // Product purchases debit wallet (CreateTransactionAction).
        return $paymentMethod === 'wallet';
    }

    /**
     * @return array{awarded: bool, points: int, already_awarded: bool, ledger: ?LoyaltyPointLedger}
     */
    public function awardForSuccessfulTransaction(Transaction $transaction): array
    {
        return DB::transaction(function () use ($transaction) {
            $lockedTx = Transaction::query()->where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            if (! $this->isProductPurchaseEligible($lockedTx)) {
                return [
                    'awarded' => false,
                    'points' => 0,
                    'already_awarded' => false,
                    'ledger' => null,
                ];
            }

            $existing = LoyaltyPointLedger::query()
                ->where('transaction_id', $lockedTx->id)
                ->where('type', LoyaltyPointLedger::TYPE_EARN)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return [
                    'awarded' => false,
                    'points' => (int) $existing->points,
                    'already_awarded' => true,
                    'ledger' => $existing,
                ];
            }

            $points = $this->calculateEarnPoints((float) $lockedTx->amount);
            if ($points <= 0) {
                return [
                    'awarded' => false,
                    'points' => 0,
                    'already_awarded' => false,
                    'ledger' => null,
                ];
            }

            $account = $this->lockAccount((int) $lockedTx->user_id);
            $account->points_balance += $points;
            $account->save();
            $this->syncWalletPointsMirror($account);

            $ledger = LoyaltyPointLedger::query()->create([
                'user_id' => $lockedTx->user_id,
                'type' => LoyaltyPointLedger::TYPE_EARN,
                'points' => $points,
                'remaining_points' => $points,
                'transaction_id' => $lockedTx->id,
                'expires_at' => now()->addMonthsNoOverflow(self::EXPIRY_MONTHS),
                'status' => 'posted',
                'reference' => 'EARN-'.$lockedTx->invoice_number,
                'reason' => 'Earn from SUCCESS purchase',
                'meta' => [
                    'amount' => (float) $lockedTx->amount,
                    'invoice' => $lockedTx->invoice_number,
                ],
            ]);

            $this->recalculateTier((int) $lockedTx->user_id, $account);

            ActivityLog::create([
                'user_id' => null,
                'activity' => 'LOYALTY_POINTS_EARNED',
                'payload' => [
                    'user_id' => $lockedTx->user_id,
                    'transaction_id' => $lockedTx->id,
                    'points' => $points,
                ],
            ]);

            return [
                'awarded' => true,
                'points' => $points,
                'already_awarded' => false,
                'ledger' => $ledger,
            ];
        });
    }

    /**
     * SUCCESS → REFUNDED point reverse. Never debits wallet for clawback.
     *
     * @return array{reversed: bool, points_reversed: int, clawback_held: int, already_reversed: bool}
     */
    public function reverseEarnedPoints(Transaction $transaction): array
    {
        return DB::transaction(function () use ($transaction) {
            $lockedTx = Transaction::query()->where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            $existingReverse = LoyaltyPointLedger::query()
                ->where('transaction_id', $lockedTx->id)
                ->where('type', LoyaltyPointLedger::TYPE_REVERSE)
                ->lockForUpdate()
                ->first();

            if ($existingReverse) {
                return [
                    'reversed' => false,
                    'points_reversed' => abs((int) $existingReverse->points),
                    'clawback_held' => (int) (($existingReverse->meta['clawback_held'] ?? 0)),
                    'already_reversed' => true,
                ];
            }

            $earn = LoyaltyPointLedger::query()
                ->where('transaction_id', $lockedTx->id)
                ->where('type', LoyaltyPointLedger::TYPE_EARN)
                ->lockForUpdate()
                ->first();

            if (! $earn) {
                return [
                    'reversed' => false,
                    'points_reversed' => 0,
                    'clawback_held' => 0,
                    'already_reversed' => false,
                ];
            }

            $account = $this->lockAccount((int) $lockedTx->user_id);
            $earnedPts = (int) $earn->points;
            $remaining = (int) $earn->remaining_points;
            $alreadyConsumed = max(0, $earnedPts - $remaining);

            $pointsReversed = $remaining;
            if ($pointsReversed > 0) {
                $account->points_balance = max(0, (int) $account->points_balance - $pointsReversed);
                $earn->remaining_points = 0;
                $earn->save();
            }

            $clawbackHeld = $alreadyConsumed;
            if ($clawbackHeld > 0) {
                $account->points_held_clawback += $clawbackHeld;
                LoyaltyPointLedger::query()->create([
                    'user_id' => $lockedTx->user_id,
                    'type' => LoyaltyPointLedger::TYPE_CLAWBACK_HOLD,
                    'points' => -1 * $clawbackHeld,
                    'remaining_points' => 0,
                    'transaction_id' => $lockedTx->id,
                    'status' => 'held',
                    'reference' => 'CLAWBACK-'.$lockedTx->invoice_number,
                    'reason' => 'Points already redeemed — clawback held (no wallet debit)',
                    'meta' => [
                        'earned' => $earnedPts,
                        'remaining_at_reverse' => $remaining,
                        'held' => $clawbackHeld,
                    ],
                ]);
            }

            $account->save();
            $this->syncWalletPointsMirror($account);

            LoyaltyPointLedger::query()->create([
                'user_id' => $lockedTx->user_id,
                'type' => LoyaltyPointLedger::TYPE_REVERSE,
                'points' => -1 * $earnedPts,
                'remaining_points' => 0,
                'transaction_id' => $lockedTx->id,
                'status' => 'posted',
                'reference' => 'REV-'.$lockedTx->invoice_number,
                'reason' => 'Reverse earn on SUCCESS→REFUNDED',
                'meta' => [
                    'points_reversed' => $pointsReversed,
                    'clawback_held' => $clawbackHeld,
                ],
            ]);

            ActivityLog::create([
                'user_id' => null,
                'activity' => 'LOYALTY_POINTS_REVERSED',
                'payload' => [
                    'user_id' => $lockedTx->user_id,
                    'transaction_id' => $lockedTx->id,
                    'points_reversed' => $pointsReversed,
                    'clawback_held' => $clawbackHeld,
                ],
            ]);

            return [
                'reversed' => true,
                'points_reversed' => $pointsReversed,
                'clawback_held' => $clawbackHeld,
                'already_reversed' => false,
            ];
        });
    }

    /**
     * Redeem points → wallet credit (1 poin = Rp1). Minimum 100.
     *
     * @return array{redeemed: bool, points: int, wallet_credit: float, transaction_id: ?int, already_processed: bool}
     */
    public function redeemPoints(User $user, int $points, string $idempotencyKey): array
    {
        if ($points < self::MIN_REDEEM) {
            throw ValidationException::withMessages([
                'points' => ['Minimum redeem adalah '.self::MIN_REDEEM.' poin.'],
            ]);
        }

        return DB::transaction(function () use ($user, $points, $idempotencyKey) {
            $existing = LoyaltyPointLedger::query()
                ->where('idempotency_key', $idempotencyKey)
                ->where('type', LoyaltyPointLedger::TYPE_REDEEM)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return [
                    'redeemed' => false,
                    'points' => abs((int) $existing->points),
                    'wallet_credit' => (float) abs((int) $existing->points),
                    'transaction_id' => $existing->transaction_id,
                    'already_processed' => true,
                ];
            }

            $account = $this->lockAccount((int) $user->id);
            $available = $this->availableRedeemablePoints($account);
            if ($available < $points) {
                throw ValidationException::withMessages([
                    'points' => ['Saldo poin tidak mencukupi.'],
                ]);
            }

            $this->consumeEarnBatchesFifo((int) $user->id, $points);

            $account->points_balance = max(0, (int) $account->points_balance - $points);
            $account->save();
            $this->syncWalletPointsMirror($account);

            $wallet = Wallet::query()->where('user_id', $user->id)->lockForUpdate()->first();
            if (! $wallet) {
                throw ValidationException::withMessages([
                    'wallet' => ['Wallet tidak ditemukan.'],
                ]);
            }

            $credit = (float) $points; // 1 poin = Rp1
            $wallet->balance += $credit;
            $wallet->save();

            $invoice = 'LOY-RDM-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
            $tx = Transaction::query()->create([
                'user_id' => $user->id,
                'invoice_number' => $invoice,
                'service_name' => 'Redeem Poin Loyalty',
                'target_number' => $wallet->wallet_number,
                'amount' => $credit,
                'admin_fee' => 0,
                'total_payment' => $credit,
                'payment_method' => 'loyalty_redeem',
                'status' => TransactionStatus::SUCCESS->value,
                'notes' => "Redeem {$points} poin → Rp ".number_format($credit, 0, ',', '.'),
                'idempotency_key' => $idempotencyKey,
            ]);

            $this->walletLedger->record(
                $wallet,
                WalletMutation::TYPE_LOYALTY_REDEEM,
                $credit,
                'credit',
                "Loyalty redeem: {$points} poin",
                $tx->id
            );

            // Avoid re-earn: payment_method loyalty_redeem is excluded.
            LoyaltyPointLedger::query()->create([
                'user_id' => $user->id,
                'type' => LoyaltyPointLedger::TYPE_REDEEM,
                'points' => -1 * $points,
                'remaining_points' => 0,
                'transaction_id' => $tx->id,
                'status' => 'posted',
                'reference' => $invoice,
                'idempotency_key' => $idempotencyKey,
                'reason' => 'User redeem to wallet',
            ]);

            event(new \App\Events\WalletCredited($wallet, $credit, "Loyalty redeem: {$points} poin", $tx->id));

            ActivityLog::create([
                'user_id' => $user->id,
                'activity' => 'LOYALTY_POINTS_REDEEMED',
                'payload' => [
                    'points' => $points,
                    'wallet_credit' => $credit,
                    'transaction_id' => $tx->id,
                    'idempotency_key' => $idempotencyKey,
                ],
            ]);

            return [
                'redeemed' => true,
                'points' => $points,
                'wallet_credit' => $credit,
                'transaction_id' => $tx->id,
                'already_processed' => false,
            ];
        });
    }

    /**
     * Expire earn batches past expires_at. Does not credit wallet.
     */
    public function expirePoints(?int $userId = null): int
    {
        $expiredCount = 0;

        $query = LoyaltyPointLedger::query()
            ->where('type', LoyaltyPointLedger::TYPE_EARN)
            ->where('remaining_points', '>', 0)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->orderBy('id');

        if ($userId) {
            $query->where('user_id', $userId);
        }

        $query->chunkById(100, function ($rows) use (&$expiredCount) {
            foreach ($rows as $earn) {
                DB::transaction(function () use ($earn, &$expiredCount) {
                    $locked = LoyaltyPointLedger::query()->where('id', $earn->id)->lockForUpdate()->first();
                    if (! $locked || (int) $locked->remaining_points <= 0) {
                        return;
                    }
                    if (! $locked->expires_at || $locked->expires_at->isFuture()) {
                        return;
                    }

                    $pts = (int) $locked->remaining_points;
                    $account = $this->lockAccount((int) $locked->user_id);
                    $account->points_balance = max(0, (int) $account->points_balance - $pts);
                    $account->save();
                    $this->syncWalletPointsMirror($account);

                    $locked->remaining_points = 0;
                    $locked->save();

                    LoyaltyPointLedger::query()->create([
                        'user_id' => $locked->user_id,
                        'type' => LoyaltyPointLedger::TYPE_EXPIRE,
                        'points' => -1 * $pts,
                        'remaining_points' => 0,
                        'transaction_id' => $locked->transaction_id,
                        'status' => 'posted',
                        'reference' => 'EXP-'.$locked->id,
                        'reason' => 'Expired after 12 months',
                        'meta' => ['earn_ledger_id' => $locked->id],
                    ]);

                    ActivityLog::create([
                        'user_id' => null,
                        'activity' => 'LOYALTY_POINTS_EXPIRED',
                        'payload' => [
                            'user_id' => $locked->user_id,
                            'points' => $pts,
                            'earn_ledger_id' => $locked->id,
                        ],
                    ]);

                    $expiredCount++;
                });
            }
        });

        return $expiredCount;
    }

    /**
     * Finance (or Owner override) manual adjustment. Reason required.
     *
     * @param  'credit'|'debit'  $direction
     * @return array{adjusted: bool, points: int, already_processed: bool}
     */
    public function adjustPoints(
        User $target,
        int $points,
        string $direction,
        string $reason,
        User $actor,
        string $idempotencyKey
    ): array {
        if (trim($reason) === '') {
            throw ValidationException::withMessages([
                'reason' => ['Alasan penyesuaian poin wajib diisi.'],
            ]);
        }

        if ($points <= 0) {
            throw ValidationException::withMessages([
                'points' => ['Nominal poin harus lebih dari 0.'],
            ]);
        }

        $direction = strtolower($direction);
        if (! in_array($direction, ['credit', 'debit'], true)) {
            throw ValidationException::withMessages([
                'direction' => ['Arah harus credit atau debit.'],
            ]);
        }

        if (! $this->actorMayAdjust($actor)) {
            throw ValidationException::withMessages([
                'actor' => ['Hanya Finance/Owner yang boleh menyesuaikan poin.'],
            ]);
        }

        return DB::transaction(function () use ($target, $points, $direction, $reason, $actor, $idempotencyKey) {
            $existing = LoyaltyPointLedger::query()
                ->where('idempotency_key', $idempotencyKey)
                ->where('type', LoyaltyPointLedger::TYPE_ADJUST)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return [
                    'adjusted' => false,
                    'points' => abs((int) $existing->points),
                    'already_processed' => true,
                ];
            }

            $account = $this->lockAccount((int) $target->id);

            if ($direction === 'debit' && (int) $account->points_balance < $points) {
                throw ValidationException::withMessages([
                    'points' => ['Saldo poin tidak mencukupi untuk debit.'],
                ]);
            }

            if ($direction === 'credit') {
                $account->points_balance += $points;
                $signed = $points;
                // Manual credit earns as non-expiring remaining batch so redeem works.
                LoyaltyPointLedger::query()->create([
                    'user_id' => $target->id,
                    'type' => LoyaltyPointLedger::TYPE_ADJUST,
                    'points' => $signed,
                    'remaining_points' => $points,
                    'expires_at' => now()->addMonthsNoOverflow(self::EXPIRY_MONTHS),
                    'status' => 'posted',
                    'reference' => 'ADJ-'.Str::upper(Str::random(8)),
                    'idempotency_key' => $idempotencyKey,
                    'reason' => $reason,
                    'actor_id' => $actor->id,
                    'meta' => ['direction' => $direction],
                ]);
            } else {
                $this->consumeEarnBatchesFifo((int) $target->id, $points);
                $account->points_balance = max(0, (int) $account->points_balance - $points);
                $signed = -1 * $points;
                LoyaltyPointLedger::query()->create([
                    'user_id' => $target->id,
                    'type' => LoyaltyPointLedger::TYPE_ADJUST,
                    'points' => $signed,
                    'remaining_points' => 0,
                    'status' => 'posted',
                    'reference' => 'ADJ-'.Str::upper(Str::random(8)),
                    'idempotency_key' => $idempotencyKey,
                    'reason' => $reason,
                    'actor_id' => $actor->id,
                    'meta' => ['direction' => $direction],
                ]);
            }

            $account->save();
            $this->syncWalletPointsMirror($account);

            ActivityLog::create([
                'user_id' => $actor->id,
                'activity' => 'LOYALTY_POINTS_ADJUSTED',
                'payload' => [
                    'target_user_id' => $target->id,
                    'direction' => $direction,
                    'points' => $points,
                    'reason' => $reason,
                    'idempotency_key' => $idempotencyKey,
                ],
            ]);

            return [
                'adjusted' => true,
                'points' => $points,
                'already_processed' => false,
            ];
        });
    }

    public function getBalance(User $user): array
    {
        $account = LoyaltyPoint::query()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'points_balance' => 0,
                'points_held_clawback' => 0,
                'current_tier' => 'Reguler',
            ]
        );

        $this->recalculateTier((int) $user->id, $account->fresh());
        $account->refresh();

        $monthGmv = $this->monthlySuccessGmv((int) $user->id);
        $tiers = LoyaltyTier::query()->orderBy('sort_order')->get();

        return [
            'points_balance' => (int) $account->points_balance,
            'available_points' => $this->availableRedeemablePoints($account),
            'points_held_clawback' => (int) $account->points_held_clawback,
            'current_tier' => $account->current_tier,
            'grace_anchor_month' => $account->grace_anchor_month,
            'monthly_gmv' => $monthGmv,
            'tiers' => $tiers->map(fn (LoyaltyTier $t) => [
                'name' => $t->tier_name,
                'min_monthly_transaction' => (int) $t->min_monthly_transaction,
                'benefit' => $t->benefit_json,
            ])->values()->all(),
            'rules' => [
                'earn' => 'Setiap Rp10.000 transaksi SUCCESS (amount) = 100 poin (floor). Top-up & transfer tidak dapat poin.',
                'redeem' => 'Minimum 100 poin. 1 poin = Rp1. Redeem ke saldo wallet.',
                'expiry' => 'Poin kadaluarsa 12 bulan sejak diperoleh.',
            ],
        ];
    }

    public function getHistory(User $user, int $perPage = 20)
    {
        return LoyaltyPointLedger::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function calculateTier(User $user): string
    {
        return DB::transaction(function () use ($user) {
            $account = $this->lockAccount((int) $user->id);
            $this->recalculateTier((int) $user->id, $account);

            return (string) $account->fresh()->current_tier;
        });
    }

    public function monthlySuccessGmv(int $userId, ?\Carbon\CarbonInterface $at = null): float
    {
        $at = $at ? \Carbon\Carbon::parse($at) : now();
        $start = $at->copy()->startOfMonth();
        $end = $at->copy()->endOfMonth();

        return (float) Transaction::query()
            ->where('user_id', $userId)
            ->where('status', TransactionStatus::SUCCESS->value)
            ->where('payment_method', 'wallet')
            ->whereBetween('created_at', [$start, $end])
            ->where(function ($q) {
                $q->whereRaw('LOWER(service_name) NOT LIKE ?', ['%top up%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%topup%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%transfer%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%penyesuaian%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%redeem poin%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%deposit%']);
            })
            ->sum('amount');
    }

    public function tierFromGmv(float $gmv): string
    {
        $tiers = LoyaltyTier::query()->orderByDesc('min_monthly_transaction')->get();
        foreach ($tiers as $tier) {
            if ($gmv >= (float) $tier->min_monthly_transaction) {
                return (string) $tier->tier_name;
            }
        }

        return 'Reguler';
    }

    public function actorMayAdjust(User $actor): bool
    {
        return $actor->isFinance()
            || $actor->isOwner()
            || $actor->role === UserRole::SUPER_ADMIN;
    }

    public function actorMayViewFinance(User $actor): bool
    {
        return $this->actorMayAdjust($actor) || $actor->isCustomerSupport();
    }

    protected function recalculateTier(int $userId, LoyaltyPoint $account): void
    {
        $monthKey = now()->format('Y-m');
        $gmv = $this->monthlySuccessGmv($userId);
        $earnedTier = $this->tierFromGmv($gmv);
        $earnedRank = $this->tierRank($earnedTier);
        $currentRank = $this->tierRank((string) $account->current_tier);

        if ($earnedRank >= $currentRank) {
            $account->current_tier = $earnedTier;
            $account->grace_anchor_month = null;
            $account->save();

            return;
        }

        // Downgrade path with 1 calendar-month grace (FR-DIFF-08 locked).
        if ($account->grace_anchor_month === null) {
            $account->grace_anchor_month = $monthKey;
            $account->save();

            return;
        }

        if ($account->grace_anchor_month < $monthKey) {
            $account->current_tier = $earnedTier;
            $account->grace_anchor_month = null;
            $account->save();

            return;
        }

        // Still within grace month — keep current_tier.
        $account->save();
    }

    protected function tierRank(string $tier): int
    {
        return match ($tier) {
            'Platinum' => 3,
            'Gold' => 2,
            'Silver' => 1,
            default => 0,
        };
    }

    protected function lockAccount(int $userId): LoyaltyPoint
    {
        $account = LoyaltyPoint::query()->where('user_id', $userId)->lockForUpdate()->first();
        if ($account) {
            return $account;
        }

        LoyaltyPoint::query()->firstOrCreate(
            ['user_id' => $userId],
            [
                'points_balance' => 0,
                'points_held_clawback' => 0,
                'current_tier' => 'Reguler',
            ]
        );

        return LoyaltyPoint::query()->where('user_id', $userId)->lockForUpdate()->firstOrFail();
    }

    protected function availableRedeemablePoints(LoyaltyPoint $account): int
    {
        // Held clawback does not reduce available further beyond points already spent;
        // available = current balance (already reduced on reverse when possible).
        return max(0, (int) $account->points_balance);
    }

    protected function consumeEarnBatchesFifo(int $userId, int $points): void
    {
        $remaining = $points;
        $batches = LoyaltyPointLedger::query()
            ->where('user_id', $userId)
            ->whereIn('type', [LoyaltyPointLedger::TYPE_EARN, LoyaltyPointLedger::TYPE_ADJUST])
            ->where('remaining_points', '>', 0)
            ->orderBy('expires_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }
            $take = min((int) $batch->remaining_points, $remaining);
            $batch->remaining_points = (int) $batch->remaining_points - $take;
            $batch->save();
            $remaining -= $take;
        }

        if ($remaining > 0) {
            throw ValidationException::withMessages([
                'points' => ['Batch poin tidak mencukupi untuk redeem.'],
            ]);
        }
    }

    protected function syncWalletPointsMirror(LoyaltyPoint $account): void
    {
        Wallet::query()->where('user_id', $account->user_id)->update([
            'points' => (int) $account->points_balance,
        ]);
    }
}
