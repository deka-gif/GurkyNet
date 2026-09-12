<?php

namespace App\Services\AccountDeletion;

use App\Enums\AccountDeletionStatus;
use App\Enums\TransactionStatus;
use App\Exceptions\AccountDeletionException;
use App\Models\AccountDeletionEvent;
use App\Models\DepositRequest;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawRequest;
use App\Services\NotificationService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Customer account deletion — 30-day pending_deletion then anonymize (keep tx/ledger).
 */
class AccountDeletionService
{
    public const GRACE_DAYS = 30;

    public function __construct(
        protected NotificationService $notifications,
    ) {}

    /**
     * @return array{status: string|null, scheduled_for: ?string, requested_at: ?string, reason_code: ?string, can_cancel: bool}
     */
    public function statusPayload(User $user): array
    {
        $pending = (string) $user->deletion_status === AccountDeletionStatus::PENDING_DELETION->value;

        return [
            'status' => $user->deletion_status,
            'scheduled_for' => $user->deletion_scheduled_for?->toIso8601String(),
            'requested_at' => $user->deletion_requested_at?->toIso8601String(),
            'reason_code' => $user->deletion_reason_code,
            'can_cancel' => $pending,
        ];
    }

    /**
     * @param  array{reason_code: string, reason_text?: string|null, pin: string, pin_confirmation: string}  $input
     * @return array{status: string, scheduled_for: string, requested_at: string}
     */
    public function requestDeletion(User $user, array $input): array
    {
        $this->assertCustomer($user);

        if ((string) $user->deletion_status === AccountDeletionStatus::PENDING_DELETION->value) {
            throw AccountDeletionException::alreadyPending();
        }

        $reasonCode = strtolower(trim((string) ($input['reason_code'] ?? '')));
        $reasonText = trim((string) ($input['reason_text'] ?? ''));
        if (! in_array($reasonCode, AccountDeletionStatus::REASON_CODES, true)) {
            throw AccountDeletionException::reasonRequired();
        }
        if ($reasonCode === 'other' && mb_strlen($reasonText) < 5) {
            throw AccountDeletionException::reasonRequired();
        }
        if ($reasonCode !== 'other') {
            $reasonText = $reasonText !== '' ? $reasonText : null;
        }

        $pin = (string) ($input['pin'] ?? '');
        $pinConfirmation = (string) ($input['pin_confirmation'] ?? '');
        if ($pin === '' || $pinConfirmation === '' || $pin !== $pinConfirmation) {
            throw AccountDeletionException::pinMismatch();
        }
        if (! preg_match('/^\d{6}$/', $pin)) {
            throw AccountDeletionException::invalidPin();
        }
        if (! $user->hasPin() || ! Hash::check($pin, (string) $user->transaction_pin)) {
            throw AccountDeletionException::invalidPin();
        }

        return DB::transaction(function () use ($user, $reasonCode, $reasonText) {
            /** @var User $locked */
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            if ((string) $locked->deletion_status === AccountDeletionStatus::PENDING_DELETION->value) {
                throw AccountDeletionException::alreadyPending();
            }

            $wallet = Wallet::query()->where('user_id', $locked->id)->lockForUpdate()->first();
            $balance = $wallet ? (string) $wallet->balance : '0.00';
            if (bccomp($balance, '0.00', 2) !== 0) {
                throw AccountDeletionException::walletNotEmpty();
            }

            if ($this->hasOpenMoneyObligations($locked->id)) {
                throw AccountDeletionException::openTransactions();
            }

            $requestedAt = now();
            $scheduledFor = $requestedAt->copy()->addDays(self::GRACE_DAYS);

            $locked->forceFill([
                'deletion_status' => AccountDeletionStatus::PENDING_DELETION->value,
                'deletion_requested_at' => $requestedAt,
                'deletion_scheduled_for' => $scheduledFor,
                'deletion_reason_code' => $reasonCode,
                'deletion_reason_text' => $reasonText,
                'deletion_cancelled_at' => null,
                'deletion_executed_at' => null,
                'deletion_reminder_h7_sent_at' => null,
                'deletion_reminder_h1_sent_at' => null,
            ])->save();

            $this->recordEvent($locked, AccountDeletionEvent::EVENT_REQUESTED, 'customer', [
                'reason_code' => $reasonCode,
                'scheduled_for' => $scheduledFor->toIso8601String(),
            ]);

            return [
                'status' => AccountDeletionStatus::PENDING_DELETION->value,
                'scheduled_for' => $scheduledFor->toIso8601String(),
                'requested_at' => $requestedAt->toIso8601String(),
            ];
        });
    }

    /**
     * @return array{status: null, cancelled_at: string}
     */
    public function cancelDeletion(User $user, string $pin): array
    {
        $this->assertCustomer($user);

        if (! preg_match('/^\d{6}$/', $pin)) {
            throw AccountDeletionException::invalidPin();
        }
        if (! $user->hasPin() || ! Hash::check($pin, (string) $user->transaction_pin)) {
            throw AccountDeletionException::invalidPin();
        }

        return DB::transaction(function () use ($user) {
            /** @var User $locked */
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            if ((string) $locked->deletion_status !== AccountDeletionStatus::PENDING_DELETION->value) {
                throw AccountDeletionException::notPending();
            }

            $cancelledAt = now();
            $locked->forceFill([
                'deletion_status' => null,
                'deletion_requested_at' => null,
                'deletion_scheduled_for' => null,
                'deletion_reason_code' => null,
                'deletion_reason_text' => null,
                'deletion_cancelled_at' => $cancelledAt,
                'deletion_reminder_h7_sent_at' => null,
                'deletion_reminder_h1_sent_at' => null,
            ])->save();

            $this->recordEvent($locked, AccountDeletionEvent::EVENT_CANCELLED, 'customer', [
                'cancelled_at' => $cancelledAt->toIso8601String(),
            ]);

            return [
                'status' => null,
                'cancelled_at' => $cancelledAt->toIso8601String(),
            ];
        });
    }

    /**
     * Idempotent purge for one user past scheduled_for.
     *
     * @return bool true when a purge was performed this call
     */
    public function purgeIfDue(User $user): bool
    {
        return DB::transaction(function () use ($user) {
            /** @var User|null $locked */
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->first();
            if (! $locked) {
                return false;
            }

            if ((string) $locked->deletion_status !== AccountDeletionStatus::PENDING_DELETION->value) {
                return false;
            }
            if ($locked->deletion_executed_at !== null) {
                return false;
            }
            if (! $locked->deletion_scheduled_for || $locked->deletion_scheduled_for->isFuture()) {
                return false;
            }

            // Final safety: do not purge with open money or non-zero balance.
            $wallet = Wallet::query()->where('user_id', $locked->id)->lockForUpdate()->first();
            $balance = $wallet ? (string) $wallet->balance : '0.00';
            if (bccomp($balance, '0.00', 2) !== 0 || $this->hasOpenMoneyObligations($locked->id)) {
                Log::warning('account_deletion.purge_skipped_unsafe', [
                    'user_id' => $locked->id,
                    'balance' => $balance,
                    'open' => $this->hasOpenMoneyObligations($locked->id),
                ]);
                $this->recordEvent($locked, 'purge_skipped_unsafe', 'system', [
                    'balance' => $balance,
                ]);

                return false;
            }

            $this->anonymizePersonalData($locked);

            $executedAt = now();
            $locked->forceFill([
                'deletion_status' => AccountDeletionStatus::PURGED->value,
                'deletion_executed_at' => $executedAt,
            ])->save();

            // Soft-delete after anonymize so login is blocked; transactions keep user_id.
            $locked->delete();

            $this->recordEvent($locked, AccountDeletionEvent::EVENT_EXECUTED, 'system', [
                'executed_at' => $executedAt->toIso8601String(),
                'scheduled_for' => optional($locked->deletion_scheduled_for)?->toIso8601String(),
            ]);

            return true;
        });
    }

    /**
     * Send H-7 / H-1 reminders once each. Failures are logged; never blocks purge.
     *
     * @return array{h7: int, h1: int}
     */
    public function sendDueReminders(): array
    {
        $sent = ['h7' => 0, 'h1' => 0];

        $h7Candidates = User::query()
            ->where('deletion_status', AccountDeletionStatus::PENDING_DELETION->value)
            ->whereNull('deletion_reminder_h7_sent_at')
            ->whereNotNull('deletion_scheduled_for')
            ->where('deletion_scheduled_for', '<=', now()->addDays(7))
            ->where('deletion_scheduled_for', '>', now()->addDay())
            ->orderBy('id')
            ->limit(200)
            ->get();

        foreach ($h7Candidates as $user) {
            if ($this->sendReminder($user, 7)) {
                $sent['h7']++;
            }
        }

        $h1Candidates = User::query()
            ->where('deletion_status', AccountDeletionStatus::PENDING_DELETION->value)
            ->whereNull('deletion_reminder_h1_sent_at')
            ->whereNotNull('deletion_scheduled_for')
            ->where('deletion_scheduled_for', '<=', now()->addDay())
            ->where('deletion_scheduled_for', '>', now())
            ->orderBy('id')
            ->limit(200)
            ->get();

        foreach ($h1Candidates as $user) {
            if ($this->sendReminder($user, 1)) {
                $sent['h1']++;
            }
        }

        return $sent;
    }

    public function processDuePurges(int $limit = 100): int
    {
        $ids = User::query()
            ->where('deletion_status', AccountDeletionStatus::PENDING_DELETION->value)
            ->whereNull('deletion_executed_at')
            ->whereNotNull('deletion_scheduled_for')
            ->where('deletion_scheduled_for', '<=', now())
            ->orderBy('deletion_scheduled_for')
            ->limit($limit)
            ->pluck('id');

        $done = 0;
        foreach ($ids as $id) {
            $user = User::query()->find($id);
            if ($user && $this->purgeIfDue($user)) {
                $done++;
            }
        }

        return $done;
    }

    public function assertCustomer(User $user): void
    {
        if (! $user->isUser()) {
            throw AccountDeletionException::roleNotAllowed();
        }
    }

    public function hasOpenMoneyObligations(int $userId): bool
    {
        $openStatuses = array_values(array_unique(array_merge(
            TransactionStatusMapper::reconcileOpenStatuses(),
            TransactionStatusMapper::fulfillOpenStatuses(),
            [TransactionStatus::INITIATED->value]
        )));

        if (Transaction::query()->where('user_id', $userId)->whereIn('status', $openStatuses)->exists()) {
            return true;
        }

        if (WithdrawRequest::query()
            ->where('user_id', $userId)
            ->whereIn('status', ['pending', 'on_hold'])
            ->exists()) {
            return true;
        }

        if (DepositRequest::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->exists()) {
            return true;
        }

        return false;
    }

    protected function sendReminder(User $user, int $daysLeft): bool
    {
        $column = $daysLeft === 7 ? 'deletion_reminder_h7_sent_at' : 'deletion_reminder_h1_sent_at';
        $event = $daysLeft === 7
            ? AccountDeletionEvent::EVENT_REMINDED_H7
            : AccountDeletionEvent::EVENT_REMINDED_H1;

        try {
            $fresh = User::query()->whereKey($user->id)->first();
            if (! $fresh
                || (string) $fresh->deletion_status !== AccountDeletionStatus::PENDING_DELETION->value
                || $fresh->{$column} !== null
            ) {
                return false;
            }

            $when = $fresh->deletion_scheduled_for?->timezone('Asia/Jakarta')->format('d M Y H:i') ?? '-';
            $title = $daysLeft === 7
                ? 'Pengingat: akun akan dihapus dalam 7 hari'
                : 'Pengingat: akun akan dihapus besok';
            $message = "Akun GurkyPay Anda dijadwalkan dihapus permanen pada {$when} (WIB). "
                .'Login dan batalkan penghapusan di menu Akun jika Anda berubah pikiran.';

            $this->notifications->send(
                $fresh,
                $title,
                $message,
                NotificationService::CATEGORY_ANNOUNCEMENT,
                ['database', 'email', 'push'],
                [
                    'dedupe_key' => "account_deletion_reminder_h{$daysLeft}_{$fresh->id}_".($fresh->deletion_scheduled_for?->format('Ymd') ?? 'x'),
                    'deep_link' => '/akun/hapus-akun',
                ]
            );

            $fresh->forceFill([$column => now()])->save();
            $this->recordEvent($fresh, $event, 'system', [
                'days_left' => $daysLeft,
                'scheduled_for' => optional($fresh->deletion_scheduled_for)?->toIso8601String(),
            ]);

            return true;
        } catch (\Throwable $e) {
            Log::warning('account_deletion.reminder_failed', [
                'user_id' => $user->id,
                'days_left' => $daysLeft,
                'error' => $e->getMessage(),
            ]);

            // Still mark sent attempt column? Owner: failed send must NOT delay purge,
            // and reminders must not repeat forever. Mark timestamp so we don't loop,
            // but record failure in audit payload.
            try {
                $u = User::query()->whereKey($user->id)->first();
                if ($u && $u->{$column} === null) {
                    $u->forceFill([$column => now()])->save();
                    $this->recordEvent($u, $event, 'system', [
                        'days_left' => $daysLeft,
                        'delivery' => 'failed',
                        'error' => Str::limit($e->getMessage(), 200),
                    ]);
                }
            } catch (\Throwable) {
                // ignore
            }

            return false;
        }
    }

    protected function anonymizePersonalData(User $user): void
    {
        $suffix = $user->id.'_'.Str::lower(Str::random(10));

        if ($user->avatar_path) {
            try {
                Storage::disk('public')->delete($user->avatar_path);
            } catch (\Throwable) {
                // ignore
            }
        }

        $user->forceFill([
            'name' => 'Deleted User '.$user->id,
            'email' => "deleted_{$suffix}@deleted.local",
            'phone_number' => 'del'.$suffix,
            'google_id' => null,
            // Cast `hashed` will hash once — do not pre-hash.
            'password' => Str::random(40),
            'transaction_pin' => null,
            'pin_updated_at' => null,
            'avatar_path' => null,
            'birth_date' => null,
            'gender' => null,
            'address' => null,
            'email_verified_at' => null,
            'phone_verified_at' => null,
            'gurky_pay_id' => 'DEL'.$user->id.Str::upper(Str::random(6)),
        ]);

        $user->save();

        // Soft-delete wallet row (balance already 0); ledger/tx keep user_id.
        $wallet = Wallet::query()->where('user_id', $user->id)->first();
        if ($wallet && ! $wallet->trashed()) {
            $wallet->delete();
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function recordEvent(User $user, string $event, string $actor, array $payload = []): void
    {
        AccountDeletionEvent::create([
            'user_id' => $user->id,
            'event' => $event,
            'actor' => $actor,
            'payload' => array_merge($payload, [
                'timestamp' => now()->toIso8601String(),
            ]),
        ]);
    }
}
