<?php

namespace App\Services\Subscriptions;

use App\Actions\Transaction\CreateTransactionAction;
use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\User;
use App\Models\UserSubscription;
use App\Models\Wallet;
use App\Services\NotificationService;
use App\Support\Features\TransactionFeatureGate;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * FR-DIFF-02 — Auto-Reorder / Langganan Berkala.
 * Never executes purchase while PURCHASE_ENABLED=false.
 * Reuses CreateTransactionAction + ProviderRouter (no second purchase engine).
 */
class AutoReorderService
{
    public function __construct(
        protected TransactionFeatureGate $gate,
        protected CreateTransactionAction $createTransaction,
        protected NotificationService $notifications
    ) {}

    public function create(User $user, int $productId, string $targetNumber, int $scheduleDay, string $pin): UserSubscription
    {
        $this->assertPin($user, $pin);
        $this->assertScheduleDay($scheduleDay);

        $product = Product::query()->findOrFail($productId);

        return DB::transaction(function () use ($user, $product, $targetNumber, $scheduleDay) {
            $sub = UserSubscription::query()->create([
                'user_id' => $user->id,
                'product_id' => $product->id,
                'target_number' => $targetNumber,
                'schedule_day' => $scheduleDay,
                'status' => UserSubscription::STATUS_ACTIVE,
                'next_run_at' => $this->computeNextRunAt($scheduleDay),
                'retry_count' => 0,
                'idempotency_seed' => (string) Str::uuid(),
            ]);

            ActivityLog::create([
                'user_id' => $user->id,
                'activity' => 'AUTO_REORDER_CREATED',
                'payload' => ['subscription_id' => $sub->id, 'schedule_day' => $scheduleDay],
            ]);

            return $sub->fresh(['product']);
        });
    }

    public function update(User $user, UserSubscription $sub, array $data): UserSubscription
    {
        $this->assertOwner($user, $sub);
        if ($sub->status === UserSubscription::STATUS_CANCELED) {
            throw ValidationException::withMessages(['subscription' => ['Subscription sudah dibatalkan.']]);
        }

        if (isset($data['schedule_day'])) {
            $this->assertScheduleDay((int) $data['schedule_day']);
            $sub->schedule_day = (int) $data['schedule_day'];
            $sub->next_run_at = $this->computeNextRunAt($sub->schedule_day);
        }
        if (isset($data['target_number'])) {
            $sub->target_number = (string) $data['target_number'];
        }
        if (isset($data['product_id'])) {
            Product::query()->findOrFail((int) $data['product_id']);
            $sub->product_id = (int) $data['product_id'];
        }
        $sub->save();

        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => 'AUTO_REORDER_UPDATED',
            'payload' => ['subscription_id' => $sub->id],
        ]);

        return $sub->fresh(['product']);
    }

    public function pause(User $user, UserSubscription $sub, ?string $reason = null): UserSubscription
    {
        $this->assertOwner($user, $sub);
        $sub->status = UserSubscription::STATUS_PAUSED;
        $sub->last_failure_reason = $reason;
        $sub->next_retry_at = null;
        $sub->save();

        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => 'AUTO_REORDER_PAUSED',
            'payload' => ['subscription_id' => $sub->id, 'reason' => $reason],
        ]);

        $this->notifications->send(
            $user,
            'Langganan otomatis dijeda',
            $reason ?: 'Subscription auto-reorder Anda dijeda.',
            'warning'
        );

        return $sub->fresh(['product']);
    }

    public function resume(User $user, UserSubscription $sub, string $pin): UserSubscription
    {
        $this->assertOwner($user, $sub);
        $this->assertPin($user, $pin);
        if ($sub->status === UserSubscription::STATUS_CANCELED) {
            throw ValidationException::withMessages(['subscription' => ['Subscription sudah dibatalkan.']]);
        }

        $sub->status = UserSubscription::STATUS_ACTIVE;
        $sub->retry_count = 0;
        $sub->next_retry_at = null;
        $sub->last_failure_reason = null;
        $sub->next_run_at = $this->computeNextRunAt((int) $sub->schedule_day);
        $sub->save();

        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => 'AUTO_REORDER_RESUMED',
            'payload' => ['subscription_id' => $sub->id],
        ]);

        return $sub->fresh(['product']);
    }

    public function cancel(User $user, UserSubscription $sub): UserSubscription
    {
        $this->assertOwner($user, $sub);
        $sub->status = UserSubscription::STATUS_CANCELED;
        $sub->next_run_at = null;
        $sub->next_retry_at = null;
        $sub->save();

        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => 'AUTO_REORDER_CANCELED',
            'payload' => ['subscription_id' => $sub->id],
        ]);

        return $sub->fresh(['product']);
    }

    /**
     * Process due subscriptions. Skips purchase entirely when gate OFF.
     *
     * @return array{processed:int,skipped_gate:int,paused:int,succeeded:int,retried:int}
     */
    public function processDue(?Carbon $now = null): array
    {
        $now = $now ?? now();
        $stats = ['processed' => 0, 'skipped_gate' => 0, 'paused' => 0, 'succeeded' => 0, 'retried' => 0];

        $due = UserSubscription::query()
            ->where('status', UserSubscription::STATUS_ACTIVE)
            ->where(function ($q) use ($now) {
                $q->where(function ($q2) use ($now) {
                    $q2->whereNotNull('next_run_at')->where('next_run_at', '<=', $now)
                        ->where(function ($q3) {
                            $q3->whereNull('next_retry_at')->orWhere('retry_count', 0);
                        });
                })->orWhere(function ($q2) use ($now) {
                    $q2->where('retry_count', '>', 0)
                        ->whereNotNull('next_retry_at')
                        ->where('next_retry_at', '<=', $now);
                });
            })
            ->orderBy('id')
            ->limit(100)
            ->get();

        foreach ($due as $sub) {
            $stats['processed']++;
            $result = $this->executeOne($sub->fresh(), $now);
            $stats[$result] = ($stats[$result] ?? 0) + 1;
        }

        return $stats;
    }

    /**
     * @return 'skipped_gate'|'paused'|'succeeded'|'retried'
     */
    public function executeOne(UserSubscription $sub, ?Carbon $now = null): string
    {
        $now = $now ?? now();

        if (! $sub->isActive()) {
            return 'paused';
        }

        // Locked decision #19 — never purchase while gate OFF.
        if (! $this->gate->purchaseEnabled()) {
            ActivityLog::create([
                'user_id' => $sub->user_id,
                'activity' => 'AUTO_REORDER_SKIPPED_GATE',
                'payload' => [
                    'subscription_id' => $sub->id,
                    'purchase_enabled' => false,
                ],
            ]);

            // Keep subscription stored; advance next_run to avoid busy-loop on every minute.
            $sub->next_run_at = $this->computeNextRunAt((int) $sub->schedule_day, $now->copy()->addDay());
            $sub->next_retry_at = null;
            $sub->save();

            return 'skipped_gate';
        }

        $user = User::query()->find($sub->user_id);
        $product = Product::query()->find($sub->product_id);
        if (! $user || ! $product) {
            return $this->failAndMaybePause($sub, 'User/produk tidak ditemukan', $now);
        }

        $wallet = Wallet::query()->where('user_id', $user->id)->first();
        $need = (float) $product->sell_price + (float) $product->admin_fee;
        if (! $wallet || (float) $wallet->balance < $need) {
            $this->pause($user, $sub, 'Saldo tidak mencukupi untuk auto-reorder');
            ActivityLog::create([
                'user_id' => $user->id,
                'activity' => 'AUTO_REORDER_INSUFFICIENT_BALANCE',
                'payload' => ['subscription_id' => $sub->id, 'required' => $need],
            ]);

            return 'paused';
        }

        $runKey = sprintf(
            'auto-reorder:%d:%s:r%d',
            $sub->id,
            ($sub->next_retry_at && $sub->retry_count > 0)
                ? $sub->next_retry_at->format('YmdHi')
                : ($sub->next_run_at?->format('Y-m-d') ?? $now->format('Y-m-d')),
            (int) $sub->retry_count
        );

        try {
            $tx = $this->createTransaction->execute(
                $user,
                (string) $product->sku_code,
                (string) $sub->target_number,
                '', // PIN skipped for trusted subscription path
                null,
                $runKey,
                ['trusted_subscription' => true, 'subscription_id' => $sub->id]
            );

            $sub->last_transaction_id = $tx->id;
            $sub->last_run_at = $now;
            $sub->retry_count = 0;
            $sub->next_retry_at = null;
            $sub->last_failure_reason = null;
            $sub->next_run_at = $this->computeNextRunAt((int) $sub->schedule_day, $now->copy()->addDay());
            $sub->save();

            $this->notifications->send(
                $user,
                'Auto-reorder berhasil',
                'Pembelian terjadwal '.$product->name.' sedang/sudah diproses (invoice '.$tx->invoice_number.').',
                'success'
            );

            ActivityLog::create([
                'user_id' => $user->id,
                'activity' => 'AUTO_REORDER_EXECUTED',
                'payload' => [
                    'subscription_id' => $sub->id,
                    'transaction_id' => $tx->id,
                    'idempotency_key' => $runKey,
                ],
            ]);

            return 'succeeded';
        } catch (ValidationException $e) {
            $msg = collect($e->errors())->flatten()->first() ?: $e->getMessage();

            return $this->failAndMaybePause($sub, (string) $msg, $now);
        } catch (\Throwable $e) {
            return $this->failAndMaybePause($sub, $e->getMessage(), $now);
        }
    }

    protected function failAndMaybePause(UserSubscription $sub, string $reason, Carbon $now): string
    {
        $sub->last_failure_reason = Str::limit($reason, 250);
        $sub->retry_count = (int) $sub->retry_count + 1;

        if ($sub->retry_count >= UserSubscription::MAX_RETRIES) {
            $user = User::query()->find($sub->user_id);
            if ($user) {
                $this->pause($user, $sub, 'Gagal setelah '.$sub->retry_count.' percobaan: '.$reason);
            } else {
                $sub->status = UserSubscription::STATUS_PAUSED;
                $sub->next_retry_at = null;
                $sub->save();
            }

            return 'paused';
        }

        $sub->next_retry_at = $now->copy()->addHours(UserSubscription::RETRY_INTERVAL_HOURS);
        $sub->save();

        $user = User::query()->find($sub->user_id);
        if ($user) {
            $this->notifications->send(
                $user,
                'Auto-reorder gagal — akan dicoba lagi',
                'Percobaan '.$sub->retry_count.'/'.UserSubscription::MAX_RETRIES.'. '.$reason,
                'warning'
            );
        }

        ActivityLog::create([
            'user_id' => $sub->user_id,
            'activity' => 'AUTO_REORDER_RETRY_SCHEDULED',
            'payload' => [
                'subscription_id' => $sub->id,
                'retry_count' => $sub->retry_count,
                'next_retry_at' => optional($sub->next_retry_at)?->toIso8601String(),
                'reason' => $reason,
            ],
        ]);

        return 'retried';
    }

    public function computeNextRunAt(int $scheduleDay, ?Carbon $from = null): Carbon
    {
        $from = $from ?? now();
        $day = max(1, min(28, $scheduleDay));
        $candidate = $from->copy()->startOfDay()->day($day);
        if ($candidate->lte($from)) {
            $candidate->addMonthNoOverflow()->day($day);
        }

        return $candidate->startOfDay();
    }

    protected function assertOwner(User $user, UserSubscription $sub): void
    {
        if ((int) $sub->user_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'subscription' => ['Anda tidak berhak mengakses subscription ini.'],
            ]);
        }
    }

    protected function assertPin(User $user, string $pin): void
    {
        if ($user->transaction_pin === null || ! Hash::check($pin, $user->transaction_pin)) {
            throw ValidationException::withMessages([
                'pin' => ['PIN transaksi salah atau belum diatur.'],
            ]);
        }
    }

    protected function assertScheduleDay(int $day): void
    {
        if ($day < 1 || $day > 28) {
            throw ValidationException::withMessages([
                'schedule_day' => ['Tanggal jadwal harus 1–28.'],
            ]);
        }
    }
}
