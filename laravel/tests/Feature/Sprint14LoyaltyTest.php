<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Events\TransactionSuccess;
use App\Models\LoyaltyPoint;
use App\Models\LoyaltyPointLedger;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Loyalty\LoyaltyPointService;
use App\Services\WalletRefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 14 — FR-DIFF-01 Cashback & Poin + FR-DIFF-08 Tier Loyalitas.
 */
class Sprint14LoyaltyTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;
    protected LoyaltyPointService $loyalty;

    protected function setUp(): void
    {
        parent::setUp();
        $this->loyalty = app(LoyaltyPointService::class);

        $this->user = User::create([
            'name' => 'Loyalty User',
            'email' => 'loyalty-user@gurkynet.test',
            'phone_number' => '081900140001',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'customer',
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '10900140001',
            'balance' => 500000,
            'status' => 'active',
            'points' => 0,
        ]);
    }

    private function makePurchaseTx(float $amount, string $status = 'success', ?User $user = null): Transaction
    {
        $user = $user ?? $this->user;

        return Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'GRK-LOY-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => $amount,
            'admin_fee' => 500,
            'total_payment' => $amount + 500,
            'payment_method' => 'wallet',
            'status' => $status,
        ]);
    }

    private function staff(UserRole $role, string $email, string $phone): User
    {
        return User::create([
            'name' => $email,
            'email' => $email,
            'phone_number' => $phone,
            'password' => Hash::make('password123'),
            'role' => $role,
            'user_type' => 'staff',
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    public function test_01_earn_10000_gives_100(): void
    {
        $tx = $this->makePurchaseTx(10000);
        $r = $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertTrue($r['awarded']);
        $this->assertEquals(100, $r['points']);
        $this->assertEquals(100, LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_02_earn_25000_gives_200(): void
    {
        $tx = $this->makePurchaseTx(25000);
        $r = $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertEquals(200, $r['points']);
    }

    public function test_03_earn_9999_gives_0(): void
    {
        $tx = $this->makePurchaseTx(9999);
        $r = $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertFalse($r['awarded']);
        $this->assertEquals(0, $r['points']);
    }

    public function test_04_failed_gives_0(): void
    {
        $tx = $this->makePurchaseTx(20000, TransactionStatus::FAILED->value);
        $r = $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertEquals(0, $r['points']);
    }

    public function test_05_pending_gives_0(): void
    {
        $tx = $this->makePurchaseTx(20000, TransactionStatus::PENDING_SUPPLIER->value);
        $r = $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertEquals(0, $r['points']);
    }

    public function test_06_topup_gives_0(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TOP-'.uniqid(),
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 50000,
            'admin_fee' => 0,
            'total_payment' => 50000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        $r = $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertEquals(0, $r['points']);
    }

    public function test_07_transfer_gives_0(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRF-'.uniqid(),
            'service_name' => 'Transfer Saldo',
            'target_number' => '081111',
            'amount' => 50000,
            'admin_fee' => 0,
            'total_payment' => 50000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        $r = $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertEquals(0, $r['points']);
    }

    public function test_08_duplicate_success_one_award(): void
    {
        $tx = $this->makePurchaseTx(20000);
        $a = $this->loyalty->awardForSuccessfulTransaction($tx);
        $b = $this->loyalty->awardForSuccessfulTransaction($tx->fresh());
        $this->assertTrue($a['awarded']);
        $this->assertTrue($b['already_awarded']);
        $this->assertEquals(1, LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'earn')->count());
        $this->assertEquals(200, LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_09_concurrent_award_one(): void
    {
        $tx = $this->makePurchaseTx(30000);
        event(new TransactionSuccess($tx));
        event(new TransactionSuccess($tx->fresh()));
        $this->assertEquals(1, LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'earn')->count());
        $this->assertEquals(300, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_10_redeem_100_to_wallet(): void
    {
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(10000));
        $before = (float) $this->wallet->fresh()->balance;
        $r = $this->loyalty->redeemPoints($this->user, 100, 'rdm-100-'.uniqid());
        $this->assertTrue($r['redeemed']);
        $this->assertEquals($before + 100, (float) $this->wallet->fresh()->balance);
        $this->assertEquals(0, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_11_partial_redeem(): void
    {
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(50000)); // 500 pts
        $this->loyalty->redeemPoints($this->user, 200, 'rdm-part-'.uniqid());
        $this->assertEquals(300, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_12_redeem_below_100_rejected(): void
    {
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(20000));
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $this->loyalty->redeemPoints($this->user, 50, 'rdm-low-'.uniqid());
    }

    public function test_13_concurrent_redeem_safe(): void
    {
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(10000)); // 100
        $key1 = 'rdm-c1-'.uniqid();
        $key2 = 'rdm-c2-'.uniqid();
        $r1 = $this->loyalty->redeemPoints($this->user, 100, $key1);
        try {
            $this->loyalty->redeemPoints($this->user, 100, $key2);
            $this->fail('Second redeem should fail');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertTrue($r1['redeemed']);
            $this->assertEquals(0, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
        }
    }

    public function test_14_duplicate_redeem_safe(): void
    {
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(20000));
        $key = 'rdm-dup-'.uniqid();
        $a = $this->loyalty->redeemPoints($this->user, 100, $key);
        $b = $this->loyalty->redeemPoints($this->user, 100, $key);
        $this->assertTrue($a['redeemed']);
        $this->assertTrue($b['already_processed']);
        $this->assertEquals(100, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_15_redeem_ledger_once(): void
    {
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(10000));
        $r = $this->loyalty->redeemPoints($this->user, 100, 'rdm-led-'.uniqid());
        $this->assertEquals(1, WalletMutation::where('reference_id', (string) $r['transaction_id'])->where('type', 'loyalty_redeem')->count());
        $this->assertEquals(1, LoyaltyPointLedger::where('type', 'redeem')->where('transaction_id', $r['transaction_id'])->count());
    }

    public function test_16_refund_reverses_points(): void
    {
        $tx = $this->makePurchaseTx(20000);
        $this->loyalty->awardForSuccessfulTransaction($tx);
        app(WalletRefundService::class)->refundSuccessToRefunded($tx, 'Refund field', 'finance');
        $this->assertEquals(0, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
        $this->assertEquals(1, LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'reverse')->count());
    }

    public function test_17_refund_replay_no_double_reverse(): void
    {
        $tx = $this->makePurchaseTx(20000);
        $this->loyalty->awardForSuccessfulTransaction($tx);
        $svc = app(WalletRefundService::class);
        $svc->refundSuccessToRefunded($tx, 'Refund', 'finance');
        $svc->refundSuccessToRefunded($tx->fresh(), 'Refund again', 'finance');
        $this->assertEquals(1, LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'reverse')->count());
        $this->assertEquals(0, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_18_refund_after_redeem_clawback_hold(): void
    {
        $tx = $this->makePurchaseTx(20000); // 200 pts
        $this->loyalty->awardForSuccessfulTransaction($tx);
        $walletBefore = (float) $this->wallet->fresh()->balance;
        $this->loyalty->redeemPoints($this->user, 200, 'rdm-all-'.uniqid());
        $walletAfterRedeem = (float) $this->wallet->fresh()->balance;
        $this->assertEquals($walletBefore + 200, $walletAfterRedeem);

        app(WalletRefundService::class)->refundSuccessToRefunded($tx->fresh(), 'Refund after redeem', 'finance');

        $account = LoyaltyPoint::where('user_id', $this->user->id)->first();
        $this->assertEquals(0, (int) $account->points_balance);
        $this->assertEquals(200, (int) $account->points_held_clawback);
        $this->assertEquals(1, LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'clawback_hold')->count());
        // No unauthorized clawback wallet debit beyond the SUCCESS refund credit itself
        $this->assertEquals($walletAfterRedeem + 20500, (float) $this->wallet->fresh()->balance); // refund total_payment
    }

    public function test_19_no_unauthorized_wallet_debit_on_clawback(): void
    {
        $tx = $this->makePurchaseTx(10000);
        $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->loyalty->redeemPoints($this->user, 100, 'rdm-x-'.uniqid());
        $balanceAfterRedeem = (float) $this->wallet->fresh()->balance;

        $rev = $this->loyalty->reverseEarnedPoints($tx->fresh());
        $this->assertEquals(100, $rev['clawback_held']);
        // reverse alone must not debit wallet
        $this->assertEquals($balanceAfterRedeem, (float) $this->wallet->fresh()->balance);
    }

    public function test_20_points_expire_after_12_months(): void
    {
        $tx = $this->makePurchaseTx(10000);
        $this->loyalty->awardForSuccessfulTransaction($tx);
        LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'earn')->update([
            'expires_at' => now()->subDay(),
        ]);
        $count = $this->loyalty->expirePoints($this->user->id);
        $this->assertGreaterThanOrEqual(1, $count);
        $this->assertEquals(0, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
        $this->assertEquals(1, LoyaltyPointLedger::where('user_id', $this->user->id)->where('type', 'expire')->count());
    }

    public function test_21_expired_cannot_redeem(): void
    {
        $tx = $this->makePurchaseTx(10000);
        $this->loyalty->awardForSuccessfulTransaction($tx);
        LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'earn')->update([
            'expires_at' => now()->subDay(),
        ]);
        $this->loyalty->expirePoints($this->user->id);
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $this->loyalty->redeemPoints($this->user, 100, 'rdm-exp-'.uniqid());
    }

    public function test_22_history_remains_after_expire(): void
    {
        $tx = $this->makePurchaseTx(10000);
        $this->loyalty->awardForSuccessfulTransaction($tx);
        LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'earn')->update([
            'expires_at' => now()->subDay(),
        ]);
        $this->loyalty->expirePoints($this->user->id);
        $this->assertEquals(1, LoyaltyPointLedger::where('transaction_id', $tx->id)->where('type', 'earn')->count());
        $this->assertEquals(1, LoyaltyPointLedger::where('user_id', $this->user->id)->where('type', 'expire')->count());
    }

    public function test_23_finance_adjustment_works(): void
    {
        $finance = $this->staff(UserRole::FINANCE, 'fin-loy@gurkynet.test', '081900149901');
        $r = $this->loyalty->adjustPoints($this->user, 150, 'credit', 'Promo kompensasi', $finance, 'adj-1-'.uniqid());
        $this->assertTrue($r['adjusted']);
        $this->assertEquals(150, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_24_adjustment_reason_required(): void
    {
        $finance = $this->staff(UserRole::FINANCE, 'fin-loy2@gurkynet.test', '081900149902');
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $this->loyalty->adjustPoints($this->user, 10, 'credit', '  ', $finance, 'adj-2-'.uniqid());
    }

    public function test_25_cs_adjustment_forbidden(): void
    {
        $cs = $this->staff(UserRole::CUSTOMER_SUPPORT, 'cs-loy@gurkynet.test', '081900149903');
        Sanctum::actingAs($cs);
        $this->postJson('/api/v1/admin/finance/loyalty/adjust', [
            'user_id' => $this->user->id,
            'points' => 10,
            'direction' => 'credit',
            'reason' => 'should fail',
            'idempotency_key' => 'adj-cs-'.uniqid(),
        ])->assertStatus(403);
    }

    public function test_26_duplicate_adjustment_safe(): void
    {
        $finance = $this->staff(UserRole::FINANCE, 'fin-loy3@gurkynet.test', '081900149904');
        $key = 'adj-dup-'.uniqid();
        $a = $this->loyalty->adjustPoints($this->user, 50, 'credit', 'bonus', $finance, $key);
        $b = $this->loyalty->adjustPoints($this->user, 50, 'credit', 'bonus', $finance, $key);
        $this->assertTrue($a['adjusted']);
        $this->assertTrue($b['already_processed']);
        $this->assertEquals(50, (int) LoyaltyPoint::where('user_id', $this->user->id)->value('points_balance'));
    }

    public function test_27_tier_below_1m_reguler(): void
    {
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(500000));
        $this->assertEquals('Reguler', $this->loyalty->calculateTier($this->user));
    }

    public function test_28_tier_silver_at_1m(): void
    {
        $this->seedMonthlyGmv(1000000);
        $this->assertEquals('Silver', $this->loyalty->calculateTier($this->user));
    }

    public function test_29_tier_gold_at_3m(): void
    {
        $this->seedMonthlyGmv(3000000);
        $this->assertEquals('Gold', $this->loyalty->calculateTier($this->user));
    }

    public function test_30_tier_platinum_at_5m(): void
    {
        $this->seedMonthlyGmv(5000000);
        $this->assertEquals('Platinum', $this->loyalty->calculateTier($this->user));
    }

    public function test_31_upgrade_immediate(): void
    {
        $this->seedMonthlyGmv(900000);
        $this->assertEquals('Reguler', $this->loyalty->calculateTier($this->user));
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(100000));
        $this->assertEquals('Silver', $this->loyalty->calculateTier($this->user));
    }

    public function test_32_downgrade_grace_works(): void
    {
        $this->seedMonthlyGmv(3000000);
        $this->assertEquals('Gold', $this->loyalty->calculateTier($this->user));

        // Simulate next month with low GMV: set grace_anchor to previous month then recalc with 0 GMV this month
        $account = LoyaltyPoint::where('user_id', $this->user->id)->first();
        $account->update([
            'current_tier' => 'Gold',
            'grace_anchor_month' => null,
        ]);

        // Wipe current month txs so GMV=0, first fall → enter grace keep Gold
        Transaction::where('user_id', $this->user->id)->delete();
        LoyaltyPointLedger::where('user_id', $this->user->id)->where('type', 'earn')->delete();
        $this->assertEquals('Gold', $this->loyalty->calculateTier($this->user));
        $this->assertEquals(now()->format('Y-m'), LoyaltyPoint::where('user_id', $this->user->id)->value('grace_anchor_month'));

        // Next month still short → downgrade
        LoyaltyPoint::where('user_id', $this->user->id)->update([
            'grace_anchor_month' => now()->subMonthNoOverflow()->format('Y-m'),
        ]);
        $this->assertEquals('Reguler', $this->loyalty->calculateTier($this->user));
    }

    public function test_33_only_success_amount_counts_for_tier(): void
    {
        Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'FAIL-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '0812',
            'amount' => 5000000,
            'admin_fee' => 0,
            'total_payment' => 5000000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
        ]);
        $this->assertEquals(0.0, $this->loyalty->monthlySuccessGmv($this->user->id));
        $this->assertEquals('Reguler', $this->loyalty->calculateTier($this->user));
    }

    public function test_34_topup_transfer_not_in_gmv(): void
    {
        Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TOP2-'.uniqid(),
            'service_name' => 'Top Up Saldo',
            'target_number' => 'x',
            'amount' => 5000000,
            'admin_fee' => 0,
            'total_payment' => 5000000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRF2-'.uniqid(),
            'service_name' => 'Transfer Saldo',
            'target_number' => 'x',
            'amount' => 5000000,
            'admin_fee' => 0,
            'total_payment' => 5000000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        $this->assertEquals(0.0, $this->loyalty->monthlySuccessGmv($this->user->id));
    }

    public function test_35_agent_level_pricing_unaffected(): void
    {
        $agent = User::create([
            'name' => 'Agent Loy',
            'email' => 'agent-loy@gurkynet.test',
            'phone_number' => '081900148888',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'agent',
            'agent_level' => 'gold',
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $agent->id,
            'wallet_number' => '10900148888',
            'balance' => 100000,
            'status' => 'active',
        ]);
        $tx = $this->makePurchaseTx(1000000, 'success', $agent);
        $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertEquals('gold', $agent->fresh()->agent_level);
        $this->assertEquals('Silver', $this->loyalty->calculateTier($agent));
    }

    public function test_36_user_a_cannot_access_user_b_points(): void
    {
        $other = User::create([
            'name' => 'Other',
            'email' => 'other-loy@gurkynet.test',
            'phone_number' => '081900147777',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'customer',
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $other->id,
            'wallet_number' => '10900147777',
            'balance' => 10000,
            'status' => 'active',
        ]);
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(20000, 'success', $other));

        Sanctum::actingAs($this->user);
        $res = $this->getJson('/api/v1/loyalty')->assertOk();
        $this->assertEquals(0, (int) ($res->json('data.points_balance') ?? 0));
    }

    public function test_37_user_a_cannot_redeem_user_b_points(): void
    {
        $other = User::create([
            'name' => 'Other2',
            'email' => 'other2-loy@gurkynet.test',
            'phone_number' => '081900147776',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'customer',
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $other->id,
            'wallet_number' => '10900147776',
            'balance' => 10000,
            'status' => 'active',
        ]);
        $this->loyalty->awardForSuccessfulTransaction($this->makePurchaseTx(20000, 'success', $other));

        Sanctum::actingAs($this->user);
        $this->postJson('/api/v1/loyalty/redeem', [
            'points' => 100,
            'idempotency_key' => 'steal-'.uniqid(),
        ])->assertStatus(422);
    }

    public function test_38_unauthorized_role_denied_adjust(): void
    {
        $ops = $this->staff(UserRole::OPERATIONS, 'ops-loy@gurkynet.test', '081900149905');
        Sanctum::actingAs($ops);
        $this->postJson('/api/v1/admin/finance/loyalty/adjust', [
            'user_id' => $this->user->id,
            'points' => 10,
            'direction' => 'credit',
            'reason' => 'nope',
            'idempotency_key' => 'ops-'.uniqid(),
        ])->assertStatus(403);
    }

    public function test_39_uses_amount_not_total_payment(): void
    {
        // amount 9999, total_payment would be higher with fees — still 0 points
        $tx = $this->makePurchaseTx(9999);
        $this->assertEquals(10499.0, (float) $tx->total_payment);
        $r = $this->loyalty->awardForSuccessfulTransaction($tx);
        $this->assertEquals(0, $r['points']);
    }

    private function seedMonthlyGmv(float $amount): void
    {
        // Split into chunks of 500k to avoid single huge earn side-effects where not needed
        $remaining = $amount;
        while ($remaining > 0) {
            $chunk = min(500000, $remaining);
            Transaction::create([
                'user_id' => $this->user->id,
                'invoice_number' => 'GMV-'.uniqid(),
                'service_name' => 'Pulsa',
                'target_number' => '0812',
                'amount' => $chunk,
                'admin_fee' => 0,
                'total_payment' => $chunk,
                'payment_method' => 'wallet',
                'status' => TransactionStatus::SUCCESS->value,
            ]);
            $remaining -= $chunk;
        }
    }
}
