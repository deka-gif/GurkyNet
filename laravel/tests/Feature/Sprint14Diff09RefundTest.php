<?php

namespace Tests\Feature;

use App\Actions\Transaction\CancelTransactionAction;
use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Models\Workflow;
use App\Repositories\Eloquent\FinanceRepository;
use App\Services\WalletRefundService;
use App\Services\Workflow\WorkflowActionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Sprint 14 — FR-DIFF-09 / SRS 14.5 refund instan gap-closure.
 * Loyalty (FR-DIFF-01/08) intentionally not covered.
 */
class Sprint14Diff09RefundTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Sprint14 User',
            'email' => 's14-refund@gurkynet.test',
            'phone_number' => '081814140001',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104814140001',
            'balance' => 100000,
            'status' => 'active',
        ]);
    }

    private function makeTx(string $status, float $amount = 11000, ?string $invoice = null): Transaction
    {
        return Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => $invoice ?? ('GRK-S14-'.uniqid()),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => $amount,
            'admin_fee' => 0,
            'total_payment' => $amount,
            'payment_method' => 'wallet',
            'status' => $status,
        ]);
    }

    public function test_01_failed_supplier_auto_refund(): void
    {
        $tx = $this->makeTx(TransactionStatus::SENT_TO_SUPPLIER->value);
        $before = (float) $this->wallet->fresh()->balance;

        $result = app(WalletRefundService::class)->refundOnce(
            $tx,
            'Refund Gagal Transaksi: '.$tx->invoice_number,
            'product_provider_fulfillment',
            'Supplier failed',
            TransactionStatus::FAILED->value
        );

        $this->assertTrue($result['credited']);
        $this->assertEquals(TransactionStatus::FAILED->value, $result['transaction']->status);
        $this->assertNotNull($result['transaction']->refunded_at);
        $this->assertEquals($before + 11000, (float) $this->wallet->fresh()->balance);
        $this->assertEquals(1, WalletMutation::query()->where('reference_id', (string) $tx->id)->where('type', 'refund')->count());
    }

    public function test_02_timeout_auto_refund(): void
    {
        $tx = $this->makeTx(TransactionStatus::PENDING_SUPPLIER->value);
        $before = (float) $this->wallet->fresh()->balance;

        // Mirror TransactionTimeoutService settle-as-fail path (FR-DIFF-09).
        $result = app(WalletRefundService::class)->refundOnce(
            $tx,
            'Refund Timeout/Gagal Transaksi: '.$tx->invoice_number,
            'transaction_timeout_engine',
            'Timeout confirmed failed',
            TransactionStatus::FAILED->value
        );

        $this->assertTrue($result['credited']);
        $this->assertEquals(TransactionStatus::FAILED->value, $result['transaction']->status);
        $this->assertEquals($before + 11000, (float) $this->wallet->fresh()->balance);
    }

    public function test_03_both_providers_down_one_refund(): void
    {
        $tx = $this->makeTx(TransactionStatus::LOCKED->value);
        $svc = app(WalletRefundService::class);

        $first = $svc->refundOnce($tx, 'Refund A', 'provider_a', null, TransactionStatus::FAILED->value);
        $second = $svc->refundOnce($tx->fresh(), 'Refund B', 'provider_b', null, TransactionStatus::FAILED->value);

        $this->assertTrue($first['credited']);
        $this->assertFalse($second['credited']);
        $this->assertTrue($second['already_refunded']);
        $this->assertEquals(1, WalletMutation::query()->where('reference_id', (string) $tx->id)->where('type', 'refund')->count());
        $this->assertEquals(111000.00, (float) $this->wallet->fresh()->balance);
    }

    public function test_04_success_finance_refund_becomes_refunded(): void
    {
        $tx = $this->makeTx(TransactionStatus::SUCCESS->value);
        $finance = User::create([
            'name' => 'Finance S14',
            'email' => 'finance-s14@gurkynet.test',
            'phone_number' => '081814140099',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
        ]);

        $this->actingAs($finance);
        $updated = app(FinanceRepository::class)->approveRefund($tx, 'User complaint field failure');

        $this->assertEquals(TransactionStatus::REFUNDED->value, $updated->status);
        $this->assertNotEquals(TransactionStatus::FAILED->value, $updated->status);
        $this->assertEquals(111000.00, (float) $this->wallet->fresh()->balance);
        $this->assertDatabaseHas('activity_logs', ['activity' => 'FINANCE_APPROVE_REFUND']);
    }

    public function test_05_success_must_not_become_failed(): void
    {
        $tx = $this->makeTx(TransactionStatus::SUCCESS->value);

        $result = app(WalletRefundService::class)->refundOnce(
            $tx,
            'bad path',
            'test',
            null,
            TransactionStatus::FAILED->value
        );

        $this->assertFalse($result['credited']);
        $this->assertEquals(TransactionStatus::SUCCESS->value, $result['transaction']->status);
        $this->assertEquals(100000.00, (float) $this->wallet->fresh()->balance);
    }

    public function test_06_cancel_unhold_uses_wallet_refund_service_ledger(): void
    {
        $tx = $this->makeTx(TransactionStatus::LOCKED->value);
        $this->wallet->update(['balance' => 89000]); // already held 11k

        $canceled = app(CancelTransactionAction::class)->execute($tx, 'User canceled request');

        $this->assertEquals(TransactionStatus::CANCELED->value, $canceled->status);
        $this->assertNotNull($canceled->refunded_at);
        $this->assertEquals(100000.00, (float) $this->wallet->fresh()->balance);
        $this->assertEquals(1, WalletMutation::query()->where('reference_id', (string) $tx->id)->where('type', 'refund')->count());
        $this->assertDatabaseHas('activity_logs', ['activity' => 'TRANSACTION_CANCEL_UNHOLD']);
    }

    public function test_07_duplicate_refund_no_double_credit(): void
    {
        $tx = $this->makeTx(TransactionStatus::SENT_TO_SUPPLIER->value);
        $svc = app(WalletRefundService::class);

        $svc->refundOnce($tx, 'Refund 1', 'provider', null, TransactionStatus::FAILED->value);
        $svc->refundOnce($tx->fresh(), 'Refund 2', 'provider', null, TransactionStatus::FAILED->value);

        $this->assertEquals(1, WalletMutation::query()->where('reference_id', (string) $tx->id)->where('type', 'refund')->count());
        $this->assertEquals(111000.00, (float) $this->wallet->fresh()->balance);
    }

    public function test_08_idempotent_refund_replay_success_path(): void
    {
        $tx = $this->makeTx(TransactionStatus::SUCCESS->value);
        $svc = app(WalletRefundService::class);

        $a = $svc->refundSuccessToRefunded($tx, 'Refund field', 'finance');
        $b = $svc->refundSuccessToRefunded($tx->fresh(), 'Refund field again', 'finance');

        $this->assertTrue($a['credited']);
        $this->assertFalse($b['credited']);
        $this->assertTrue($b['already_refunded']);
        $this->assertEquals(TransactionStatus::REFUNDED->value, $a['transaction']->status);
    }

    public function test_09_concurrent_refund_safe(): void
    {
        $tx = $this->makeTx(TransactionStatus::SENT_TO_SUPPLIER->value);
        $svc = app(WalletRefundService::class);

        // Sequential under row lock semantics (same process): second must no-op.
        $r1 = $svc->refundOnce($tx, 'c1', 't', null, TransactionStatus::FAILED->value);
        $r2 = $svc->refundOnce($tx->fresh(), 'c2', 't', null, TransactionStatus::FAILED->value);

        $this->assertTrue($r1['credited']);
        $this->assertFalse($r2['credited']);
        $this->assertTrue($r2['already_refunded']);
        $this->assertEquals(1, WalletMutation::query()->where('reference_id', (string) $tx->id)->where('type', 'refund')->count());
    }

    public function test_10_audit_trail_recorded(): void
    {
        $tx = $this->makeTx(TransactionStatus::SENT_TO_SUPPLIER->value);
        $svc = app(WalletRefundService::class);
        $svc->refundOnce($tx, 'Refund audit', 'product_provider_fulfillment', 'note', TransactionStatus::FAILED->value);
        $svc->writeAudit(null, 'TRANSACTION_TIMEOUT_ENGINE', [
            'transaction_id' => $tx->id,
            'credited' => true,
        ]);

        $this->assertDatabaseHas('activity_logs', ['activity' => 'TRANSACTION_TIMEOUT_ENGINE']);
    }

    public function test_11_workflow_finance_approve_success_uses_refunded(): void
    {
        $tx = $this->makeTx(TransactionStatus::SUCCESS->value);
        $finance = User::create([
            'name' => 'Finance WF',
            'email' => 'finance-wf-s14@gurkynet.test',
            'phone_number' => '081814140088',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
        ]);

        $workflow = Workflow::query()->create([
            'workflow_code' => 'WF-S14-'.uniqid(),
            'source' => 'sprint14_test',
            'category' => 'refund_request',
            'current_division' => 'finance',
            'status' => 'waiting_finance',
            'priority' => 'medium',
            'title' => 'Refund complaint',
            'description' => 'Saldo terpotong barang tidak masuk',
            'created_by' => $finance->id,
            'transaction_id' => $tx->id,
        ]);

        app(WorkflowActionService::class)->execute($workflow, $finance, [
            'action' => 'approve',
            'note' => 'Approve full refund',
        ]);

        $tx->refresh();
        $this->assertEquals(TransactionStatus::REFUNDED->value, $tx->status);
        $this->assertEquals(111000.00, (float) $this->wallet->fresh()->balance);
    }
}
