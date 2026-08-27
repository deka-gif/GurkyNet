<?php

namespace Tests\Feature;

use App\Actions\Auth\RegisterUserAction;
use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\CommissionLedger;
use App\Models\ReferralCode;
use App\Models\ReferralFraudFlag;
use App\Models\ReferralRelation;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Referral\ReferralCodeService;
use App\Services\Referral\ReferralCommissionService;
use App\Services\Referral\ReferralFraudService;
use App\Services\Referral\ReferralRelationService;
use App\Services\WalletRefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 16 — SRS Bagian 31 Referral Berjenjang (FR-REF-01..09).
 */
class Sprint16ReferralTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $overrides = []): User
    {
        $user = User::create(array_merge([
            'name' => 'S16 User',
            'email' => 's16-'.uniqid().'@gurkynet.test',
            'phone_number' => '0819'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'customer',
            'transaction_pin' => Hash::make('123456'),
            'email_verified_at' => now(),
        ], $overrides));

        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10916'.uniqid(),
            'balance' => 500000,
            'status' => 'active',
        ]);

        app(ReferralCodeService::class)->ensureForUser($user);

        return $user->fresh();
    }

    private function staff(UserRole $role): User
    {
        return User::create([
            'name' => $role->value,
            'email' => $role->value.'-'.uniqid().'@gurkynet.test',
            'phone_number' => '0818'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => $role,
            'user_type' => 'staff',
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    private function registerWithCode(?string $code, array $extra = []): User
    {
        return app(RegisterUserAction::class)->execute(array_merge([
            'name' => 'Reg '.uniqid(),
            'email' => 'reg-'.uniqid().'@gurkynet.test',
            'phone_number' => '0817'.random_int(10000000, 99999999),
            'password' => 'password123',
            'transaction_pin' => '123456',
            'email_verified_at' => now(),
            'referral_code' => $code,
        ], $extra));
    }

    private function purchaseTx(User $user, float $amount, string $status = 'success', array $extra = []): Transaction
    {
        return Transaction::create(array_merge([
            'user_id' => $user->id,
            'invoice_number' => 'GRK-S16-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => $amount,
            'admin_fee' => 0,
            'total_payment' => $amount,
            'payment_method' => 'wallet',
            'status' => $status,
        ], $extra));
    }

    // ——— Codes ———

    public function test_01_auto_generate_unique(): void
    {
        $a = $this->makeUser();
        $b = $this->makeUser();
        $this->assertNotEquals(
            ReferralCode::where('user_id', $a->id)->value('code'),
            ReferralCode::where('user_id', $b->id)->value('code')
        );
        $this->assertEquals(1, ReferralCode::where('user_id', $a->id)->count());
    }

    public function test_02_to_05_custom_code_validation(): void
    {
        $user = $this->makeUser();
        $svc = app(ReferralCodeService::class);
        $row = $svc->setCustomCode($user, 'ABC12345');
        $this->assertEquals('ABC12345', $row->code);
        $this->assertTrue($row->is_custom);

        try {
            $svc->setCustomCode($user, 'AB');
            $this->fail('short code');
        } catch (ValidationException $e) {
            $this->assertTrue(true);
        }

        try {
            $svc->setCustomCode($user, 'ABC-123!');
            $this->fail('non alnum');
        } catch (ValidationException $e) {
            $this->assertTrue(true);
        }

        $other = $this->makeUser();
        $this->expectException(ValidationException::class);
        $svc->setCustomCode($other, 'ABC12345');
    }

    // ——— Relations ———

    public function test_06_to_12_relationship_rules(): void
    {
        $a = $this->makeUser();
        $aCode = ReferralCode::where('user_id', $a->id)->value('code');

        $plain = $this->registerWithCode(null);
        $this->assertEquals(0, ReferralRelation::where('downline_user_id', $plain->id)->count());

        $b = $this->registerWithCode($aCode);
        $this->assertDatabaseHas('referral_relations', [
            'downline_user_id' => $b->id,
            'upline_user_id' => $a->id,
            'level' => 1,
        ]);

        $bCode = ReferralCode::where('user_id', $b->id)->value('code');
        $c = $this->registerWithCode($bCode);
        $this->assertDatabaseHas('referral_relations', [
            'downline_user_id' => $c->id,
            'upline_user_id' => $b->id,
            'level' => 1,
        ]);
        $this->assertDatabaseHas('referral_relations', [
            'downline_user_id' => $c->id,
            'upline_user_id' => $a->id,
            'level' => 2,
        ]);
        $this->assertEquals(0, ReferralRelation::where('downline_user_id', $c->id)->where('level', 3)->count());

        // immutable / no second parent
        try {
            app(ReferralRelationService::class)->attachAtRegistration($c, $aCode);
            $this->fail('immutable');
        } catch (ValidationException $e) {
            $this->assertTrue(true);
        }

        // self-referral
        try {
            app(ReferralRelationService::class)->attachAtRegistration($a, $aCode);
            $this->fail('self');
        } catch (ValidationException $e) {
            $this->assertDatabaseHas('referral_fraud_flags', ['signal' => 'self_referral_attempt']);
        }
    }

    // ——— Commission ———

    public function test_13_to_20_commission_eligibility(): void
    {
        $a = $this->makeUser();
        $b = $this->registerWithCode(ReferralCode::where('user_id', $a->id)->value('code'));
        $c = $this->registerWithCode(ReferralCode::where('user_id', $b->id)->value('code'));
        $svc = app(ReferralCommissionService::class);

        $tx = $this->purchaseTx($c, 100000);
        $r = $svc->awardForSuccessfulTransaction($tx);
        $this->assertEquals(2, $r['created']);

        $l1 = CommissionLedger::where('source_transaction_id', $tx->id)->where('level', 1)->first();
        $l2 = CommissionLedger::where('source_transaction_id', $tx->id)->where('level', 2)->first();
        $this->assertEquals(1000.0, (float) $l1->amount); // 1%
        $this->assertEquals(500.0, (float) $l2->amount); // 0.5%
        $this->assertEquals('pending', $l1->status);
        $this->assertEquals($b->id, $l1->upline_user_id);
        $this->assertEquals($a->id, $l2->upline_user_id);

        // no L3
        $d = $this->registerWithCode(ReferralCode::where('user_id', $c->id)->value('code'));
        $txD = $this->purchaseTx($d, 100000);
        $svc->awardForSuccessfulTransaction($txD);
        $this->assertEquals(2, CommissionLedger::where('source_transaction_id', $txD->id)->count());
        $this->assertFalse(CommissionLedger::where('source_transaction_id', $txD->id)->where('upline_user_id', $a->id)->exists());

        $this->assertEquals(0, $svc->awardForSuccessfulTransaction($this->purchaseTx($c, 10000, 'failed'))['created']);
        $this->assertEquals(0, $svc->awardForSuccessfulTransaction($this->purchaseTx($c, 10000, 'pending'))['created']);
        $this->assertEquals(0, $svc->awardForSuccessfulTransaction($this->purchaseTx($c, 10000, 'success', [
            'service_name' => 'Top Up Saldo',
        ]))['created']);
        $this->assertEquals(0, $svc->awardForSuccessfulTransaction($this->purchaseTx($c, 10000, 'success', [
            'service_name' => 'Transfer Saldo',
            'payment_method' => 'transfer',
        ]))['created']);
        $this->assertEquals(0, $svc->awardForSuccessfulTransaction($this->purchaseTx($c, 10000, 'success', [
            'provider_response' => ['channel' => 'partner_api'],
            'notes' => 'partner_api',
        ]))['created']);
    }

    public function test_21_22_idempotent_and_concurrent_safe(): void
    {
        $a = $this->makeUser();
        $b = $this->registerWithCode(ReferralCode::where('user_id', $a->id)->value('code'));
        $svc = app(ReferralCommissionService::class);
        $tx = $this->purchaseTx($b, 50000);

        $svc->awardForSuccessfulTransaction($tx);
        $svc->awardForSuccessfulTransaction($tx);
        $this->assertEquals(1, CommissionLedger::where('source_transaction_id', $tx->id)->where('level', 1)->count());

        // concurrent-ish: two sequential lock paths still one row (unique constraint)
        $tx2 = $this->purchaseTx($b, 20000);
        $svc->awardForSuccessfulTransaction($tx2);
        $svc->awardForSuccessfulTransaction($tx2->fresh());
        $this->assertEquals(1, CommissionLedger::where('source_transaction_id', $tx2->id)->count());
    }

    // ——— Release + caps ———

    public function test_23_to_28_release_and_caps(): void
    {
        $a = $this->makeUser();
        $b = $this->registerWithCode(ReferralCode::where('user_id', $a->id)->value('code'));
        $svc = app(ReferralCommissionService::class);
        $tx = $this->purchaseTx($b, 100000);
        $svc->awardForSuccessfulTransaction($tx);
        $row = CommissionLedger::where('source_transaction_id', $tx->id)->where('level', 1)->first();
        $this->assertTrue($row->release_at->greaterThan(now()->addDays(2)));

        $row->update(['release_at' => now()->subMinute()]);
        $before = (float) Wallet::where('user_id', $a->id)->value('balance');
        $r1 = $svc->releaseOne($row->id);
        $this->assertEquals('released', $r1);
        $after = (float) Wallet::where('user_id', $a->id)->value('balance');
        $this->assertEquals(1000.0, round($after - $before, 2));
        $this->assertDatabaseHas('wallet_mutations', [
            'type' => WalletMutation::TYPE_REFERRAL_COMMISSION,
            'wallet_id' => Wallet::where('user_id', $a->id)->value('id'),
        ]);

        $this->assertEquals('skipped', $svc->releaseOne($row->id)); // repeat safe

        // daily cap: create large pending then defer
        config(['referral.daily_cap' => 1500]);
        $tx2 = $this->purchaseTx($b, 100000);
        $svc->awardForSuccessfulTransaction($tx2);
        $row2 = CommissionLedger::where('source_transaction_id', $tx2->id)->where('level', 1)->first();
        $row2->update(['release_at' => now()->subMinute()]);
        $this->assertEquals('deferred_cap', $svc->releaseOne($row2->id));
        $this->assertEquals('pending', $row2->fresh()->status);

        config(['referral.daily_cap' => 1_000_000, 'referral.monthly_cap' => 1500]);
        $tx3 = $this->purchaseTx($b, 100000);
        $svc->awardForSuccessfulTransaction($tx3);
        $row3 = CommissionLedger::where('source_transaction_id', $tx3->id)->where('level', 1)->first();
        $row3->update(['release_at' => now()->subMinute()]);
        // monthly already has 1000 released; another 1000 would exceed 1500
        $this->assertEquals('deferred_cap', $svc->releaseOne($row3->id));
    }

    // ——— Refund ———

    public function test_29_to_32_refund_paths(): void
    {
        $a = $this->makeUser();
        $b = $this->registerWithCode(ReferralCode::where('user_id', $a->id)->value('code'));
        $svc = app(ReferralCommissionService::class);

        $tx = $this->purchaseTx($b, 80000);
        $svc->awardForSuccessfulTransaction($tx);
        app(WalletRefundService::class)->refundSuccessToRefunded($tx->fresh(), 'Refund pre-release', 'test');
        $row = CommissionLedger::where('source_transaction_id', $tx->id)->where('level', 1)->first();
        $this->assertEquals('reversed', $row->status);
        $this->assertEquals('skipped', $svc->releaseOne($row->id));

        $tx2 = $this->purchaseTx($b, 90000);
        $svc->awardForSuccessfulTransaction($tx2);
        $row2 = CommissionLedger::where('source_transaction_id', $tx2->id)->where('level', 1)->first();
        $row2->update(['release_at' => now()->subMinute()]);
        $balBefore = (float) Wallet::where('user_id', $a->id)->value('balance');
        $svc->releaseOne($row2->id);
        $balAfterRelease = (float) Wallet::where('user_id', $a->id)->value('balance');
        app(WalletRefundService::class)->refundSuccessToRefunded($tx2->fresh(), 'Refund post-release', 'test');
        $row2 = $row2->fresh();
        $this->assertEquals('finance_review', $row2->status);
        $this->assertEquals($balAfterRelease, (float) Wallet::where('user_id', $a->id)->value('balance')); // no clawback
        $this->assertGreaterThan($balBefore, $balAfterRelease);
        $this->assertDatabaseHas('referral_fraud_flags', ['signal' => 'released_commission_source_refunded']);
    }

    // ——— Fraud ———

    public function test_33_to_35_fraud_flag_only_no_threshold(): void
    {
        $this->assertNull(config('referral.fraud.time_window_minutes'));
        $this->assertNull(config('referral.fraud.max_accounts_same_ip'));
        $this->assertFalse(config('referral.fraud.auto_block'));

        $flag = app(ReferralFraudService::class)->flagStructural(
            $this->makeUser(),
            'manual_signal_test',
            ['note' => 'flag only']
        );
        $this->assertEquals('flagged', $flag->status);
        // no wallet mutation from flag alone
        $this->assertEquals(0, WalletMutation::where('type', WalletMutation::TYPE_REFERRAL_COMMISSION)->where('reference_id', 'like', '%'.$flag->id.'%')->count());
    }

    // ——— RBAC ———

    public function test_36_to_40_rbac_and_ownership(): void
    {
        $finance = $this->staff(UserRole::FINANCE);
        $owner = $this->staff(UserRole::OWNER);
        $cs = $this->staff(UserRole::CUSTOMER_SUPPORT);
        $a = $this->makeUser();
        $b = $this->makeUser();

        Sanctum::actingAs($finance);
        $this->putJson('/api/v1/admin/finance/referral/rules', [
            'level' => 1,
            'percentage' => 1.2,
            'reason' => 'Finance tweak',
        ])->assertOk();

        Sanctum::actingAs($owner);
        $this->getJson('/api/v1/admin/finance/referral/overview')->assertOk();
        $this->putJson('/api/v1/admin/finance/referral/rules', [
            'level' => 1,
            'percentage' => 1.3,
            'reason' => 'Owner blocked',
        ])->assertStatus(403); // EnsureOwnerReadOnly

        Sanctum::actingAs($cs);
        $this->getJson('/api/v1/admin/customer-support/referral/overview')->assertOk();
        $this->putJson('/api/v1/admin/finance/referral/rules', [
            'level' => 1,
            'percentage' => 9,
            'reason' => 'CS blocked',
        ])->assertStatus(403);

        Sanctum::actingAs($a);
        $this->getJson('/api/v1/referral')->assertOk()
            ->assertJsonPath('data.code', ReferralCode::where('user_id', $a->id)->value('code'));

        Sanctum::actingAs($b);
        $hist = $this->getJson('/api/v1/referral/history')->assertOk()->json('data');
        // B must not see A's ledger rows (query scoped by auth user)
        $ids = collect($hist['data'] ?? [])->pluck('upline_user_id')->unique();
        $this->assertFalse($ids->contains($a->id));
    }

    public function test_41_to_43_wallet_consistency(): void
    {
        $a = $this->makeUser();
        $b = $this->registerWithCode(ReferralCode::where('user_id', $a->id)->value('code'));
        $svc = app(ReferralCommissionService::class);
        $tx = $this->purchaseTx($b, 50000);
        $svc->awardForSuccessfulTransaction($tx);
        $row = CommissionLedger::where('source_transaction_id', $tx->id)->where('level', 1)->first();
        $row->update(['release_at' => now()->subMinute()]);
        $svc->releaseOne($row->id);
        $svc->releaseOne($row->id);
        $this->assertEquals(1, WalletMutation::where('type', WalletMutation::TYPE_REFERRAL_COMMISSION)
            ->where('reference_id', 'commission_ledger:'.$row->id)->count());
        $this->assertEquals('released', $row->fresh()->status);
    }
}
