<?php

namespace Tests\Feature;

use App\Actions\Auth\RegisterUserAction;
use App\Actions\Wallet\TransferWalletAction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Repositories\Eloquent\WalletRepository;
use App\Services\Identity\GurkyPayIdService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class GurkyPayIdTest extends TestCase
{
    use RefreshDatabase;

    public function test_ensure_for_user_does_not_mutate_existing_wallet_number(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 1, 15, 9, 0, 0));
        $svc = app(GurkyPayIdService::class);
        $user = User::factory()->create(['created_at' => now()]);
        $code = $svc->ensureForUser($user);

        $wallet = Wallet::factory()->create([
            'user_id' => $user->id,
            'wallet_number' => '10427777000001',
            'balance' => 12345,
            'status' => 'active',
        ]);

        // Ordinary re-call (simulates any future accidental API hook) — must be side-effect free.
        $again = $svc->ensureForUser($user->fresh());
        $wallet->refresh();

        $this->assertSame($code, $again);
        $this->assertSame('10427777000001', $wallet->wallet_number);
        $this->assertNull($wallet->previous_wallet_number);
        $this->assertSame(12345.0, (float) $wallet->balance);

        Carbon::setTestNow();
    }

    public function test_format_uses_year_namespace_and_padded_sequence(): void
    {
        $svc = app(GurkyPayIdService::class);
        $this->assertSame('20263128001', $svc->format(2026, 1));
        $this->assertSame('20263128002', $svc->format(2026, 2));
        $this->assertSame('20263128100', $svc->format(2026, 100));
        $this->assertSame('20273128001', $svc->format(2027, 1));
    }

    public function test_registration_year_sequence_increments_and_resets_per_year(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 3, 15, 10, 0, 0));

        $svc = app(GurkyPayIdService::class);

        $u1 = User::factory()->create(['created_at' => now()]);
        $u2 = User::factory()->create(['created_at' => now()]);
        $u3 = User::factory()->create(['created_at' => now()]);

        $this->assertSame('20263128001', $svc->ensureForUser($u1));
        $this->assertSame('20263128002', $svc->ensureForUser($u2));
        $this->assertSame('20263128003', $svc->ensureForUser($u3));

        Carbon::setTestNow(Carbon::create(2027, 1, 5, 10, 0, 0));
        $u4 = User::factory()->create(['created_at' => now()]);
        $this->assertSame('20273128001', $svc->ensureForUser($u4));

        $u1->refresh();
        $this->assertSame('20263128001', $u1->gurky_pay_id);
        $this->assertSame('20263128001', $svc->ensureForUser($u1));

        Carbon::setTestNow();
    }

    public function test_concurrent_allocation_does_not_duplicate(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 1, 12, 0, 0));
        $svc = app(GurkyPayIdService::class);

        $users = collect(range(1, 10))->map(fn () => User::factory()->create(['created_at' => now()]));

        $codes = [];
        foreach ($users as $user) {
            DB::transaction(function () use ($svc, $user, &$codes) {
                $codes[] = $svc->ensureForUser($user);
            });
        }

        $this->assertCount(10, array_unique($codes));
        $this->assertSame('20263128001', $codes[0]);
        $this->assertSame('20263128010', $codes[9]);
        $this->assertCount(
            10,
            array_unique(DB::table('users')->whereNotNull('gurky_pay_id')->pluck('gurky_pay_id')->all())
        );

        Carbon::setTestNow();
    }

    public function test_register_assigns_same_gurky_pay_id_and_wallet_number(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 8, 1, 9, 0, 0));

        $action = app(RegisterUserAction::class);
        $user = $action->execute([
            'name' => 'Tes Gurky',
            'email' => 'gurkyid-'.uniqid().'@example.com',
            'password' => 'Password1!',
            'phone_number' => '081234567890',
        ]);

        $user->refresh()->load('wallet');
        $this->assertSame('20263128001', $user->gurky_pay_id);
        $this->assertSame('20263128001', $user->wallet?->wallet_number);
        $this->assertSame($user->gurky_pay_id, $user->wallet?->wallet_number);
        $this->assertNull($user->wallet?->previous_wallet_number);

        Carbon::setTestNow();
    }

    public function test_wallet_overview_exposes_unified_account_number(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 9, 1, 9, 0, 0));
        $svc = app(GurkyPayIdService::class);
        $user = User::factory()->create(['created_at' => now()]);
        $svc->ensureForUser($user);

        Wallet::factory()->create([
            'user_id' => $user->id,
            'wallet_number' => '10429999888877',
            'balance' => 0,
        ]);

        // Explicit repair (migration-equivalent) — NOT ensureForUser.
        $svc->syncWalletNumber($user->fresh(), (string) $user->fresh()->gurky_pay_id);
        $user->refresh()->load('wallet');
        $this->assertSame('20263128001', $user->wallet->wallet_number);
        $this->assertSame('10429999888877', $user->wallet->previous_wallet_number);

        $token = $user->createToken('test')->plainTextToken;
        $res = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/wallet');

        $res->assertOk()
            ->assertJsonPath('data.wallet.gurkyPayId', '20263128001')
            ->assertJsonPath('data.wallet.walletNo', '20263128001')
            ->assertJsonPath('data.wallet.wallet_number', '20263128001');

        Carbon::setTestNow();
    }

    public function test_unique_constraint_on_gurky_pay_id(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 1, 9, 0, 0));
        $a = User::factory()->create(['created_at' => now()]);
        app(GurkyPayIdService::class)->ensureForUser($a);

        $b = User::factory()->create(['created_at' => now()]);

        $this->expectException(\Illuminate\Database\QueryException::class);
        $b->forceFill(['gurky_pay_id' => '20263128001'])->save();

        Carbon::setTestNow();
    }

    public function test_sequence_rejects_beyond_999(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 5, 1, 9, 0, 0));
        DB::table('gurky_pay_id_sequences')->insert([
            'year' => 2026,
            'last_seq' => 999,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = User::factory()->create(['created_at' => now()]);

        try {
            app(GurkyPayIdService::class)->ensureForUser($user);
            $this->fail('Expected ValidationException when sequence exceeds 999');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('gurky_pay_id', $e->errors());
        }

        $user->refresh();
        $this->assertNull($user->gurky_pay_id);

        Carbon::setTestNow();
    }

    public function test_backfill_unifies_wallet_number_and_preserves_legacy_alias(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 2, 1, 9, 0, 0));
        $user = User::factory()->create(['created_at' => now()]);
        $wallet = Wallet::factory()->create([
            'user_id' => $user->id,
            'wallet_number' => '10421234567890',
            'balance' => 55000,
        ]);
        WalletHistory::create([
            'wallet_id' => $wallet->id,
            'amount' => 55000,
            'type' => \App\Enums\WalletHistoryType::CREDIT->value,
            'description' => 'Top Up Saldo',
        ]);

        $code = app(GurkyPayIdService::class)->ensureForUser($user);
        // ensureForUser must NOT mutate wallet_number
        $wallet->refresh();
        $this->assertSame('10421234567890', $wallet->wallet_number);
        $this->assertNull($wallet->previous_wallet_number);

        app(GurkyPayIdService::class)->syncWalletNumber($user, $code);
        $wallet->refresh();

        $this->assertSame($code, $wallet->wallet_number);
        $this->assertSame('10421234567890', $wallet->previous_wallet_number);
        $this->assertSame(55000.0, (float) $wallet->balance);
        $this->assertSame(1, WalletHistory::where('wallet_id', $wallet->id)->count());
        $this->assertSame('Top Up Saldo', WalletHistory::where('wallet_id', $wallet->id)->value('description'));

        Carbon::setTestNow();
    }

    public function test_transfer_lookup_resolves_gurky_pay_number_and_legacy_number(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 7, 1, 9, 0, 0));
        $svc = app(GurkyPayIdService::class);
        $repo = app(WalletRepository::class);

        $sender = User::factory()->create(['created_at' => now()]);
        $recipient = User::factory()->create(['created_at' => now()]);
        $svc->ensureForUser($sender);
        $svc->ensureForUser($recipient);

        $senderWallet = Wallet::factory()->create([
            'user_id' => $sender->id,
            'wallet_number' => '104211110001',
            'balance' => 100000,
            'status' => 'active',
        ]);
        $recipientWallet = Wallet::factory()->create([
            'user_id' => $recipient->id,
            'wallet_number' => '104211110002',
            'balance' => 10000,
            'status' => 'active',
        ]);

        $svc->ensureForUser($sender->fresh());
        $svc->ensureForUser($recipient->fresh());
        // ensureForUser alone must leave legacy wallet_number intact
        $senderWallet->refresh();
        $this->assertSame('104211110001', $senderWallet->wallet_number);

        $svc->syncWalletNumber($sender->fresh(), (string) $sender->fresh()->gurky_pay_id);
        $svc->syncWalletNumber($recipient->fresh(), (string) $recipient->fresh()->gurky_pay_id);
        $sender->refresh()->load('wallet');
        $recipient->refresh()->load('wallet');

        $this->assertSame($sender->gurky_pay_id, $sender->wallet->wallet_number);
        $this->assertSame('104211110001', $sender->wallet->previous_wallet_number);

        // Current GurkyPay number
        $this->assertSame(
            $recipient->wallet->id,
            $repo->findByWalletNumber($recipient->gurky_pay_id)?->id
        );
        // Legacy alias still resolves
        $this->assertSame(
            $recipient->wallet->id,
            $repo->findByWalletNumber('104211110002')?->id
        );

        $sender->forceFill([
            'transaction_pin' => Hash::make('123456'),
            'pin_updated_at' => now(),
        ])->save();

        $tx = app(TransferWalletAction::class)->execute(
            $sender,
            $recipient->gurky_pay_id,
            15000,
            '123456',
            0
        );

        $this->assertSame($recipient->gurky_pay_id, $tx->target_number);
        $senderWallet->refresh();
        $recipientWallet->refresh();
        $this->assertSame(85000.0, (float) $senderWallet->balance);
        $this->assertSame(25000.0, (float) $recipientWallet->balance);

        Carbon::setTestNow();
    }

    public function test_immutability_does_not_regenerate_id(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 10, 1, 9, 0, 0));
        $svc = app(GurkyPayIdService::class);
        $user = User::factory()->create(['created_at' => now()]);
        $first = $svc->ensureForUser($user);

        Carbon::setTestNow(Carbon::create(2027, 2, 1, 9, 0, 0));
        $second = $svc->ensureForUser($user->fresh());
        $this->assertSame($first, $second);
        $this->assertSame('20263128001', $second);

        Carbon::setTestNow();
    }

    public function test_registration_rollback_does_not_leave_orphan_sequence_claim(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 11, 1, 9, 0, 0));

        // Force wallet create failure via unique collision simulation after first success.
        $action = app(RegisterUserAction::class);
        $ok = $action->execute([
            'name' => 'Ok User',
            'email' => 'ok-'.uniqid().'@example.com',
            'password' => 'Password1!',
            'phone_number' => '081111111111',
        ]);
        $ok->refresh()->load('wallet');
        $this->assertSame('20263128001', $ok->gurky_pay_id);
        $this->assertSame('20263128001', $ok->wallet->wallet_number);

        // Pretend sequence was advanced but user insert fails — outer transaction rolls back.
        try {
            DB::transaction(function () {
                $svc = app(GurkyPayIdService::class);
                $user = User::factory()->create(['created_at' => now()]);
                $svc->ensureForUser($user);
                throw new \RuntimeException('force rollback');
            });
        } catch (\RuntimeException $e) {
            $this->assertSame('force rollback', $e->getMessage());
        }

        // After rollback, next registration must still get 20263128002 (seq 1 consumed by $ok only).
        $next = $action->execute([
            'name' => 'Next User',
            'email' => 'next-'.uniqid().'@example.com',
            'password' => 'Password1!',
            'phone_number' => '082222222222',
        ]);
        $next->refresh()->load('wallet');
        $this->assertSame('20263128002', $next->gurky_pay_id);
        $this->assertSame('20263128002', $next->wallet->wallet_number);

        Carbon::setTestNow();
    }

    public function test_historical_target_number_not_rewritten_on_unify(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 12, 1, 9, 0, 0));
        $user = User::factory()->create(['created_at' => now()]);
        $wallet = Wallet::factory()->create([
            'user_id' => $user->id,
            'wallet_number' => '10429999000001',
            'balance' => 1000,
        ]);

        $tx = \App\Models\Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV-HIST-'.uniqid(),
            'service_name' => 'Transfer Dana',
            'target_number' => '10429999000001',
            'amount' => 1000,
            'admin_fee' => 0,
            'total_payment' => 1000,
            'payment_method' => 'wallet',
            'status' => 'success',
            'notes' => 'Legacy transfer snapshot',
        ]);

        app(GurkyPayIdService::class)->ensureForUser($user);
        $code = (string) $user->fresh()->gurky_pay_id;
        // ensureForUser must not rewrite live wallet_number
        $this->assertSame('10429999000001', $wallet->fresh()->wallet_number);

        app(GurkyPayIdService::class)->syncWalletNumber($user->fresh(), $code);
        $wallet->refresh();

        $this->assertSame($code, $wallet->wallet_number);
        $this->assertSame('10429999000001', $tx->fresh()->target_number);

        Carbon::setTestNow();
    }
}
