<?php

namespace App\Services\Identity;

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Allocates immutable customer-facing GurkyPay account numbers: YYYY + 3128 + NNN.
 * Same value is stored on users.gurky_pay_id and wallets.wallet_number at registration
 * (or via migration / explicit syncWalletNumber repair). Does not replace users.id / wallets.id.
 */
class GurkyPayIdService
{
    public const NAMESPACE_CODE = '3128';

    public const MAX_SEQ = 999;

    /**
     * Ensure user has a GurkyPay ID. Idempotent — never regenerates an existing ID.
     *
     * Side-effect free for wallets: does NOT mutate wallet_number.
     * Wallet equality is set only by registration, migration, or syncWalletNumber().
     */
    public function ensureForUser(User $user): string
    {
        if (filled($user->gurky_pay_id)) {
            return (string) $user->gurky_pay_id;
        }

        return DB::transaction(function () use ($user) {
            $locked = User::query()->where('id', $user->id)->lockForUpdate()->first();
            if (! $locked) {
                throw ValidationException::withMessages([
                    'gurky_pay_id' => ['User tidak ditemukan.'],
                ]);
            }

            if (filled($locked->gurky_pay_id)) {
                return (string) $locked->gurky_pay_id;
            }

            $year = (int) ($locked->created_at?->year ?: now()->year);
            $seq = $this->nextSequenceForYear($year);
            $code = $this->format($year, $seq);

            $locked->forceFill(['gurky_pay_id' => $code])->save();

            return $code;
        });
    }

    public function format(int $year, int $seq): string
    {
        if ($seq < 1 || $seq > self::MAX_SEQ) {
            throw ValidationException::withMessages([
                'gurky_pay_id' => ["Sequence GurkyPay ID di luar rentang 001–999 untuk tahun {$year}."],
            ]);
        }

        return sprintf('%d%s%03d', $year, self::NAMESPACE_CODE, $seq);
    }

    /**
     * Explicit repair / migration helper — NOT for ordinary API reads.
     * Sets wallets.wallet_number = accountNumber and preserves prior value
     * in previous_wallet_number when changing a live account number.
     */
    public function syncWalletNumber(User $user, string $accountNumber): void
    {
        $wallet = Wallet::query()->where('user_id', $user->id)->first();
        if (! $wallet) {
            return;
        }

        if ((string) $wallet->wallet_number === $accountNumber) {
            return;
        }

        $conflict = Wallet::query()
            ->where('wallet_number', $accountNumber)
            ->where('id', '!=', $wallet->id)
            ->exists();

        if ($conflict) {
            throw ValidationException::withMessages([
                'wallet_number' => ["Nomor akun GurkyPay {$accountNumber} sudah dipakai wallet lain."],
            ]);
        }

        $wallet->forceFill([
            'previous_wallet_number' => $wallet->previous_wallet_number ?: $wallet->wallet_number,
            'wallet_number' => $accountNumber,
        ])->save();
    }

    /**
     * Atomic yearly counter — never reuse numbers (deleted users keep their ID).
     */
    protected function nextSequenceForYear(int $year): int
    {
        $row = DB::table('gurky_pay_id_sequences')
            ->where('year', $year)
            ->lockForUpdate()
            ->first();

        if ($row === null) {
            DB::table('gurky_pay_id_sequences')->insert([
                'year' => $year,
                'last_seq' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $row = DB::table('gurky_pay_id_sequences')
                ->where('year', $year)
                ->lockForUpdate()
                ->first();
        }

        $next = (int) $row->last_seq + 1;
        if ($next > self::MAX_SEQ) {
            throw ValidationException::withMessages([
                'gurky_pay_id' => [
                    "Kuota ID GurkyPay tahun {$year} penuh (maksimal 999). Hubungi admin.",
                ],
            ]);
        }

        DB::table('gurky_pay_id_sequences')
            ->where('year', $year)
            ->update([
                'last_seq' => $next,
                'updated_at' => now(),
            ]);

        return $next;
    }
}
