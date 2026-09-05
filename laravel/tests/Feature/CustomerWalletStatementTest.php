<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Enums\WalletHistoryType;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use App\Services\Finance\Reconciliation\ReconciliationIncidentService;
use App\Services\Wallet\WalletMutationBalanceQuery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Customer financial statement — wallet_mutations SoT + recon exclusion parity.
 */
class CustomerWalletStatementTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $other;
    protected Wallet $wallet;
    protected Wallet $otherWallet;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.timezone' => 'Asia/Jakarta']);
        Carbon::setTestNow(Carbon::parse('2026-09-15 12:00:00', 'Asia/Jakarta'));

        $this->user = $this->makeUser('stmt-user@gurkynet.test', '081900000001');
        $this->user->forceFill([
            'name' => 'Agent Statement',
            'gurky_pay_id' => '20263128010',
        ])->save();

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '20263128010',
            'balance' => 0,
            'status' => 'active',
        ]);

        $this->other = $this->makeUser('stmt-other@gurkynet.test', '081900000002');
        $this->other->forceFill(['gurky_pay_id' => '20263128011'])->save();
        $this->otherWallet = Wallet::create([
            'user_id' => $this->other->id,
            'wallet_number' => '20263128011',
            'balance' => 999999,
            'status' => 'active',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeUser(string $email, string $phone): User
    {
        return User::create([
            'name' => $email,
            'email' => $email,
            'phone_number' => $phone,
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    /**
     * Insert a balance-changing mutation (and optional history for description).
     * Does not update wallets.balance unless $touchBalance is true.
     */
    private function addMutation(
        Wallet $wallet,
        string $type,
        float $signedAmount,
        string $at,
        ?string $referenceId = null,
        ?string $description = null,
        bool $touchBalance = false
    ): WalletMutation {
        $mutation = WalletMutation::create([
            'wallet_id' => $wallet->id,
            'type' => $type,
            'amount' => $signedAmount,
            'reference_id' => $referenceId,
        ]);
        $mutation->created_at = Carbon::parse($at, 'Asia/Jakarta');
        $mutation->updated_at = $mutation->created_at;
        $mutation->save();

        if ($description !== null) {
            $history = WalletHistory::create([
                'wallet_id' => $wallet->id,
                'amount' => abs($signedAmount),
                'type' => $signedAmount < 0
                    ? WalletHistoryType::DEBIT->value
                    : WalletHistoryType::CREDIT->value,
                'description' => $description,
                'reference_id' => $referenceId,
            ]);
            $history->created_at = $mutation->created_at;
            $history->updated_at = $mutation->created_at;
            $history->save();
        }

        if ($touchBalance) {
            $wallet->balance = round((float) $wallet->balance + $signedAmount, 2);
            $wallet->save();
        }

        return $mutation->fresh();
    }

    public function test_critical_september_scenario_opening_income_expense_ending(): void
    {
        // Opening seed before September: 500_000
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_TOPUP,
            500000,
            '2026-08-20 10:00:00',
            'seed-aug',
            'Seed opening',
            true
        );

        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_HOLD,
            -75000,
            '2026-09-05 09:00:00',
            '10',
            'Pembelian Pulsa',
            true
        );
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_TOPUP,
            200000,
            '2026-09-10 09:00:00',
            '11',
            'Top Up Midtrans',
            true
        );
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_REFUND,
            25000,
            '2026-09-12 09:00:00',
            '12',
            'Refund sebagian',
            true
        );
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_ADJUSTMENT,
            -10000,
            '2026-09-14 09:00:00',
            '13',
            'Penyesuaian debit',
            true
        );

        Sanctum::actingAs($this->user);
        $res = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk();

        $data = $res->json('data');
        $this->assertSame(500000.0, (float) $data['opening_balance']);
        $this->assertSame(225000.0, (float) $data['income']); // 200k + 25k
        $this->assertSame(85000.0, (float) $data['expense']); // 75k + 10k
        $this->assertSame(640000.0, (float) $data['ending_balance']);
        $this->assertEqualsWithDelta(
            (float) $data['opening_balance'] + (float) $data['income'] - (float) $data['expense'],
            (float) $data['ending_balance'],
            0.01
        );
        $this->assertSame('20263128010', $data['account']['gurky_pay_id']);
        $this->assertSame('Agent Statement', $data['account']['name']);
        $this->assertSame('Asia/Jakarta', $data['period']['timezone']);
        $this->assertSame('2026-09-01', $data['period']['start']);
        $this->assertSame('2026-09-30', $data['period']['end']);
        $this->assertArrayNotHasKey('previous_wallet_number', $data['account']);
    }

    public function test_withdraw_approval_marker_not_double_counted(): void
    {
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_TOPUP,
            200000,
            '2026-08-01 10:00:00',
            'seed',
            null,
            true
        );

        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-WD-STMT',
            'service_name' => 'Penarikan Dana',
            'target_number' => 'BCA:123',
            'amount' => 100000,
            'admin_fee' => 0,
            'total_payment' => 100000,
            'status' => TransactionStatus::SUCCESS->value,
        ]);

        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_HOLD,
            -100000,
            '2026-09-02 10:00:00',
            (string) $tx->id,
            'Hold withdraw ke BCA 123',
            true
        );

        // Marker: no balance change
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_WITHDRAW,
            -100000,
            '2026-09-03 10:00:00',
            (string) $tx->id,
            'Withdraw disetujui Finance',
            false
        );

        WithdrawRequest::create([
            'user_id' => $this->user->id,
            'amount' => 100000,
            'admin_fee' => 0,
            'method' => 'bank_transfer',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'status' => 'approved',
            'transaction_id' => $tx->id,
            'workflow' => WithdrawRequest::WORKFLOW_HOLD_QUEUE,
        ]);

        // Parity with recon
        $expected = app(ReconciliationIncidentService::class)
            ->expectedBalanceFromMutations((int) $this->wallet->id);
        $this->assertSame(100000.0, $expected);
        $this->assertSame(100000.0, (float) $this->wallet->fresh()->balance);

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');

        $this->assertSame(100000.0, (float) $data['expense']);
        $this->assertSame(0.0, (float) $data['income']);
        $this->assertSame(100000.0, (float) $data['ending_balance']);

        $types = collect($data['mutations'])->pluck('ledger_type')->all();
        $this->assertContains(WalletMutation::TYPE_HOLD, $types);
        $this->assertNotContains(WalletMutation::TYPE_WITHDRAW, $types);
    }

    public function test_refund_same_month_nets_and_next_month_splits(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 100000, '2026-08-01 10:00:00', 's', null, true);

        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_HOLD,
            -75000,
            '2026-09-05 10:00:00',
            '201',
            'Pembelian',
            true
        );
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_REFUND,
            75000,
            '2026-09-06 10:00:00',
            '201',
            'Refund',
            true
        );

        Sanctum::actingAs($this->user);
        $sep = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(75000.0, (float) $sep['expense']);
        $this->assertSame(75000.0, (float) $sep['income']);
        $this->assertSame(100000.0, (float) $sep['ending_balance']);

        // Cross-month: purchase Sep, refund Oct
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_HOLD,
            -40000,
            '2026-09-20 10:00:00',
            '202',
            'Beli 2',
            true
        );

        Carbon::setTestNow(Carbon::parse('2026-10-15 12:00:00', 'Asia/Jakarta'));
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_REFUND,
            40000,
            '2026-10-02 10:00:00',
            '202',
            'Refund bulan berikutnya',
            true
        );

        $sep2 = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(115000.0, (float) $sep2['expense']); // 75k + 40k
        $this->assertSame(75000.0, (float) $sep2['income']);
        $this->assertSame(60000.0, (float) $sep2['ending_balance']);

        $oct = $this->getJson('/api/v1/wallet/statements/2026-10')->assertOk()->json('data');
        $this->assertSame(60000.0, (float) $oct['opening_balance']);
        $this->assertSame(40000.0, (float) $oct['income']);
        $this->assertSame(0.0, (float) $oct['expense']);
        $this->assertSame(100000.0, (float) $oct['ending_balance']);
    }

    public function test_transfer_in_and_out(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 50000, '2026-08-01 10:00:00', 's', null, true);

        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_WITHDRAW,
            -20000,
            '2026-09-04 10:00:00',
            '301',
            'Transfer ke 20263128011',
            true
        );
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_TOPUP,
            15000,
            '2026-09-05 10:00:00',
            '302',
            'Transfer masuk dari 20263128999',
            true
        );

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(20000.0, (float) $data['expense']);
        $this->assertSame(15000.0, (float) $data['income']);
        $this->assertSame(45000.0, (float) $data['ending_balance']);

        $keys = collect($data['mutations'])->pluck('category_key')->all();
        $this->assertContains('transfer', $keys);
    }

    public function test_adjustment_credit_and_debit(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 10000, '2026-08-01 10:00:00', 's', null, true);
        $this->addMutation($this->wallet, WalletMutation::TYPE_ADJUSTMENT, 5000, '2026-09-01 10:00:00', 'a1', 'Adj credit', true);
        $this->addMutation($this->wallet, WalletMutation::TYPE_ADJUSTMENT, -2000, '2026-09-02 10:00:00', 'a2', 'Adj debit', true);

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(5000.0, (float) $data['income']);
        $this->assertSame(2000.0, (float) $data['expense']);
        $this->assertSame(13000.0, (float) $data['ending_balance']);
    }

    public function test_loyalty_and_referral_as_income(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_LOYALTY_REDEEM, 1000, '2026-09-01 10:00:00', 'loy', 'Redeem', true);
        $this->addMutation($this->wallet, WalletMutation::TYPE_REFERRAL_COMMISSION, 2500, '2026-09-02 10:00:00', 'ref', 'Komisi', true);

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(3500.0, (float) $data['income']);
        $this->assertSame(0.0, (float) $data['expense']);
        $this->assertSame(3500.0, (float) $data['ending_balance']);
    }

    public function test_category_from_product_sku_and_fallback_lainnya(): void
    {
        $category = ProductCategory::create([
            'name' => 'Pulsa',
            'slug' => 'pulsa',
        ]);
        Product::create([
            'product_category_id' => $category->id,
            'name' => 'Pulsa XL 10rb',
            'sku_code' => 'xl10',
            'base_price' => 10000,
            'sell_price' => 10000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-CAT',
            'service_name' => 'Pulsa XL',
            'target_number' => '0812',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => 'xl10',
            'product_name' => 'Pulsa XL 10rb',
            'price' => 10000,
            'quantity' => 1,
        ]);

        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 50000, '2026-08-01 10:00:00', 's', null, true);
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_HOLD,
            -10000,
            '2026-09-03 10:00:00',
            (string) $tx->id,
            'Pembelian Pulsa XL 10rb - 0812',
            true
        );

        // Unknown SKU → Lainnya
        $tx2 = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-UNK',
            'service_name' => 'Unknown',
            'target_number' => '0813',
            'amount' => 5000,
            'admin_fee' => 0,
            'total_payment' => 5000,
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        TransactionItem::create([
            'transaction_id' => $tx2->id,
            'product_code' => 'gone-sku',
            'product_name' => 'Gone',
            'price' => 5000,
            'quantity' => 1,
        ]);
        $this->addMutation(
            $this->wallet,
            WalletMutation::TYPE_HOLD,
            -5000,
            '2026-09-04 10:00:00',
            (string) $tx2->id,
            'Pembelian Gone',
            true
        );

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');

        $byRef = collect($data['mutations'])->keyBy('reference_id');
        $this->assertSame('telekomunikasi', $byRef[(string) $tx->id]['category_key']);
        $this->assertSame('lainnya', $byRef[(string) $tx2->id]['category_key']);

        $catKeys = collect($data['categories'])->pluck('key')->all();
        $this->assertContains('telekomunikasi', $catKeys);
        $this->assertContains('lainnya', $catKeys);
    }

    public function test_timezone_period_boundary_half_open(): void
    {
        // Exactly at Sep 1 00:00 → inside September
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 1000, '2026-09-01 00:00:00', 'b1', null, true);
        // Last instant of August → opening for September
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 2000, '2026-08-31 23:59:59', 'b0', null, true);
        // Oct 1 00:00 → outside September
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 4000, '2026-10-01 00:00:00', 'b2', null, true);

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(2000.0, (float) $data['opening_balance']);
        $this->assertSame(1000.0, (float) $data['income']);
        $this->assertSame(3000.0, (float) $data['ending_balance']);
    }

    public function test_empty_month_uses_ledger_opening_not_fake_data(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 77777, '2026-07-01 10:00:00', 's', null, true);

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(77777.0, (float) $data['opening_balance']);
        $this->assertSame(0.0, (float) $data['income']);
        $this->assertSame(0.0, (float) $data['expense']);
        $this->assertSame(77777.0, (float) $data['ending_balance']);
        $this->assertSame([], $data['mutations']);
        $this->assertSame([], $data['categories']);
    }

    public function test_historical_month_unchanged_after_later_transactions(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 100000, '2026-09-01 10:00:00', 's', null, true);

        Sanctum::actingAs($this->user);
        $before = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');

        Carbon::setTestNow(Carbon::parse('2026-10-05 12:00:00', 'Asia/Jakarta'));
        $this->addMutation($this->wallet, WalletMutation::TYPE_HOLD, -30000, '2026-10-02 10:00:00', 'x', null, true);
        $this->wallet->refresh();
        $this->assertSame(70000.0, (float) $this->wallet->balance);

        $after = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame((float) $before['ending_balance'], (float) $after['ending_balance']);
        $this->assertSame(100000.0, (float) $after['ending_balance']);
        $this->assertNotEquals((float) $this->wallet->balance, (float) $after['ending_balance']);
    }

    public function test_current_month_does_not_use_wallet_balance_shortcut(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 50000, '2026-09-01 10:00:00', 's', null, true);
        // Corrupt displayed balance intentionally — statement must ignore it
        $this->wallet->balance = 1;
        $this->wallet->save();

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(50000.0, (float) $data['ending_balance']);
        $this->assertSame(1.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_user_isolation_and_auth_required(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 1000, '2026-09-01 10:00:00', 's', null, true);
        $this->addMutation($this->otherWallet, WalletMutation::TYPE_TOPUP, 888888, '2026-09-01 10:00:00', 'o', null, true);

        $this->getJson('/api/v1/wallet/statements/2026-09')->assertUnauthorized();

        Sanctum::actingAs($this->user);
        $data = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(1000.0, (float) $data['ending_balance']);
        $this->assertSame('20263128010', $data['account']['gurky_pay_id']);

        // Query param user_id must be ignored
        $data2 = $this->getJson('/api/v1/wallet/statements/2026-09?user_id='.$this->other->id)
            ->assertOk()
            ->json('data');
        $this->assertSame(1000.0, (float) $data2['ending_balance']);
    }

    public function test_invalid_and_future_period(): void
    {
        Sanctum::actingAs($this->user);

        $this->getJson('/api/v1/wallet/statements/2026')->assertStatus(422);
        $this->getJson('/api/v1/wallet/statements/2026-9')->assertStatus(422);
        $this->getJson('/api/v1/wallet/statements/09-2026')->assertStatus(422);
        $this->getJson('/api/v1/wallet/statements/September-2026')->assertStatus(422);
        $this->getJson('/api/v1/wallet/statements/2026-13')->assertStatus(422);
        $this->getJson('/api/v1/wallet/statements/2026-10')->assertStatus(422); // future vs test now Sep 2026
    }

    public function test_no_wallet_returns_404(): void
    {
        $lonely = $this->makeUser('nowallet@gurkynet.test', '081900000099');
        Sanctum::actingAs($lonely);
        $this->getJson('/api/v1/wallet/statements/2026-09')
            ->assertStatus(404)
            ->assertJsonPath('message', 'Wallet tidak ditemukan.');
    }

    public function test_shared_balance_query_matches_recon_service(): void
    {
        $this->addMutation($this->wallet, WalletMutation::TYPE_TOPUP, 100000, '2026-09-01 10:00:00', '1', null, true);
        $this->addMutation($this->wallet, WalletMutation::TYPE_HOLD, -40000, '2026-09-02 10:00:00', '99', null, true);
        $this->addMutation($this->wallet, WalletMutation::TYPE_WITHDRAW, -40000, '2026-09-03 10:00:00', '99', null, false);

        $a = app(WalletMutationBalanceQuery::class)->expectedBalance((int) $this->wallet->id);
        $b = app(ReconciliationIncidentService::class)->expectedBalanceFromMutations((int) $this->wallet->id);
        $this->assertSame($a, $b);
        $this->assertSame(60000.0, $a);
    }
}
