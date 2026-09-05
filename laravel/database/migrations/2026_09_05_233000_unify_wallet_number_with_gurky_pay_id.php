<?php

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Unify customer-facing account number:
 * users.gurky_pay_id === wallets.wallet_number (YYYY3128NNN).
 *
 * Preserves legacy wallet_number in previous_wallet_number for transfer lookup
 * compatibility. Does NOT rewrite historical transactions.target_number /
 * ledger description text (audit evidence).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->string('previous_wallet_number')->nullable()->after('wallet_number');
            // Unique when set — legacy numbers must remain unambiguous for transfer lookup.
            $table->unique('previous_wallet_number');
        });

        $this->unifyExistingWallets();
    }

    public function down(): void
    {
        // Restore wallet_number from previous_wallet_number when present.
        Wallet::withTrashed()
            ->whereNotNull('previous_wallet_number')
            ->orderBy('id')
            ->chunkById(100, function ($wallets) {
                foreach ($wallets as $wallet) {
                    $legacy = $wallet->previous_wallet_number;
                    if (! filled($legacy)) {
                        continue;
                    }
                    // Only restore if no other wallet currently owns that number.
                    $conflict = Wallet::withTrashed()
                        ->where('wallet_number', $legacy)
                        ->where('id', '!=', $wallet->id)
                        ->exists();
                    if (! $conflict) {
                        DB::table('wallets')->where('id', $wallet->id)->update([
                            'wallet_number' => $legacy,
                            'previous_wallet_number' => null,
                        ]);
                    }
                }
            });

        Schema::table('wallets', function (Blueprint $table) {
            $table->dropUnique(['previous_wallet_number']);
            $table->dropColumn('previous_wallet_number');
        });
    }

    private function unifyExistingWallets(): void
    {
        User::query()
            ->withTrashed()
            ->with(['wallet' => fn ($q) => $q->withTrashed()])
            ->orderBy('id')
            ->chunkById(100, function ($users) {
                foreach ($users as $user) {
                    $code = $user->gurky_pay_id;
                    if (! filled($code)) {
                        continue;
                    }

                    $wallet = $user->wallet;
                    if (! $wallet) {
                        continue;
                    }

                    if ((string) $wallet->wallet_number === (string) $code) {
                        continue;
                    }

                    $conflict = Wallet::withTrashed()
                        ->where('wallet_number', $code)
                        ->where('id', '!=', $wallet->id)
                        ->exists();

                    if ($conflict) {
                        throw new \RuntimeException(
                            "Cannot unify wallet #{$wallet->id}: wallet_number {$code} already in use."
                        );
                    }

                    DB::table('wallets')->where('id', $wallet->id)->update([
                        'previous_wallet_number' => $wallet->previous_wallet_number ?: $wallet->wallet_number,
                        'wallet_number' => $code,
                        'updated_at' => now(),
                    ]);
                }
            });
    }
};
