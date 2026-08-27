<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\DepositRequest;
use App\Models\KycVerification;
use App\Models\LegalDocument;
use App\Models\PolicyAcceptance;
use App\Models\SupportTicket;
use App\Models\TaxSetting;
use App\Models\TicketReply;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawRequest;
use App\Services\Finance\FinanceReportService;
use App\Services\Legal\PolicyAcceptanceService;
use App\Services\Retention\FinancialRetentionGuard;
use App\Services\Sla\BusinessHoursService;
use App\Services\Sla\SlaEvaluationService;
use App\Services\Tax\TaxScaffoldService;
use App\Services\Website\LegalCenterService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

/**
 * Sprint 18 — Legal CMS, consent, FR-CS-03 SLA, tax scaffold, retention guard.
 */
class Sprint18LegalSlaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        app(LegalCenterService::class)->alignWithSrsContent(true);
    }

    private function user(array $o = []): User
    {
        $u = User::create(array_merge([
            'name' => 'S18 User',
            'email' => 's18-'.uniqid().'@test.local',
            'phone_number' => '0812'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'customer',
            'transaction_pin' => Hash::make('123456'),
            'email_verified_at' => now(),
        ], $o));
        Wallet::create([
            'user_id' => $u->id,
            'wallet_number' => '18'.uniqid(),
            'balance' => 10000,
            'status' => 'active',
        ]);

        return $u;
    }

    private function staff(UserRole $role): User
    {
        return User::create([
            'name' => $role->value,
            'email' => $role->value.'-'.uniqid().'@test.local',
            'phone_number' => '0813'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => $role,
            'user_type' => 'staff',
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    public function test_01_to_03_policies_available_versioned(): void
    {
        foreach ([
            LegalDocument::TYPE_PRIVACY,
            LegalDocument::TYPE_TERMS,
            LegalDocument::TYPE_REFUND,
        ] as $type) {
            $doc = LegalDocument::where('type', $type)->first();
            $this->assertNotNull($doc);
            $this->assertGreaterThanOrEqual(1, (int) $doc->version_number);
            $this->assertEquals('published', $doc->status);
            $this->assertEquals(LegalDocument::REVIEW_PENDING, $doc->legal_review_status);
            $this->assertFalse($doc->isLegallyBinding());
            $this->assertStringContainsString('SRS', strip_tags($doc->content));
        }
        $terms = LegalDocument::where('type', LegalDocument::TYPE_TERMS)->value('content');
        $this->assertStringContainsString('5 menit', $terms);
        $refund = LegalDocument::where('type', LegalDocument::TYPE_REFUND)->value('content');
        $this->assertStringContainsString('FAILED', $refund);
        $this->assertStringContainsString('REFUNDED', $refund);
    }

    public function test_04_to_07_server_side_acceptance_version_aware(): void
    {
        $user = $this->user();
        $svc = app(PolicyAcceptanceService::class);
        $rows = $svc->acceptCurrentPublished($user);
        $this->assertCount(3, $rows);

        $privacy = LegalDocument::where('type', LegalDocument::TYPE_PRIVACY)->firstOrFail();
        $acc = PolicyAcceptance::where('user_id', $user->id)
            ->where('document_type', LegalDocument::TYPE_PRIVACY)
            ->first();
        $this->assertNotNull($acc);
        $this->assertEquals((int) $privacy->version_number, (int) $acc->policy_version);
        $this->assertNotNull($acc->accepted_at);

        $this->assertTrue($svc->hasAcceptedVersion($user, LegalDocument::TYPE_PRIVACY, (int) $privacy->version_number));

        // bump published version
        $privacy->update([
            'version_number' => (int) $privacy->version_number + 1,
            'content' => $privacy->content.'<!-- v-bump -->',
            'legal_review_status' => LegalDocument::REVIEW_PENDING,
        ]);
        $this->assertTrue($svc->requiresReacceptance($user, LegalDocument::TYPE_PRIVACY));
        $this->assertFalse($svc->hasAcceptedVersion(
            $user,
            LegalDocument::TYPE_PRIVACY,
            (int) $privacy->fresh()->version_number
        ));
    }

    public function test_08_live_chat_sla_5_minutes(): void
    {
        $user = $this->user();
        $cs = $this->staff(UserRole::CUSTOMER_SUPPORT);
        $ticket = SupportTicket::create([
            'ticket_number' => 'T-CHAT-1',
            'user_id' => $user->id,
            'category' => 'Live Chat',
            'subject' => 'Hi',
            'description' => 'help',
            'priority' => 'Sedang',
            'status' => 'open',
            'source' => 'live_chat',
        ]);
        $ticket->forceFill(['created_at' => now()->subMinutes(3)])->save();
        $reply = TicketReply::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $cs->id,
            'message' => 'Halo',
        ]);
        $reply->forceFill(['created_at' => now()->subMinutes(1)])->save();
        $ticket->load('replies.user');
        $sla = app(SlaEvaluationService::class)->forSupportTicket($ticket->fresh(['replies.user']));
        $this->assertEquals('live_chat', $sla['kind']);
        $this->assertEquals(300, $sla['target_seconds']);
        $this->assertEquals(SlaEvaluationService::WITHIN, $sla['status']);

        $slow = SupportTicket::create([
            'ticket_number' => 'T-CHAT-2',
            'user_id' => $user->id,
            'category' => 'chat',
            'subject' => 'slow',
            'description' => 'x',
            'priority' => 'Sedang',
            'status' => 'open',
            'source' => 'chat',
        ]);
        $slow->forceFill(['created_at' => now()->subMinutes(20)])->save();
        $breached = app(SlaEvaluationService::class)->forSupportTicket($slow->fresh());
        $this->assertEquals(SlaEvaluationService::BREACHED, $breached['status']);
    }

    public function test_09_10_technical_and_funds_ticket_sla(): void
    {
        $user = $this->user();
        $tech = SupportTicket::create([
            'ticket_number' => 'T-TECH',
            'user_id' => $user->id,
            'category' => 'Teknis',
            'subject' => 'bug',
            'description' => 'x',
            'priority' => 'Sedang',
            'status' => 'open',
        ]);
        $tech->forceFill(['created_at' => now()->subHours(10), 'updated_at' => now()->subHours(10)])->save();
        $techSla = app(SlaEvaluationService::class)->forSupportTicket($tech->fresh());
        $this->assertEquals(86400, $techSla['target_seconds']);
        $this->assertNotEquals(SlaEvaluationService::BREACHED, $techSla['status']);

        $funds = SupportTicket::create([
            'ticket_number' => 'T-FUNDS',
            'user_id' => $user->id,
            'category' => 'Refund Dana',
            'subject' => 'saldo',
            'description' => 'x',
            'priority' => 'Tinggi',
            'status' => 'open',
        ]);
        $funds->forceFill(['created_at' => now()->subHours(50), 'updated_at' => now()->subHours(50)])->save();
        $fundsSla = app(SlaEvaluationService::class)->forSupportTicket($funds->fresh());
        $this->assertEquals(172800, $fundsSla['target_seconds']);
        $this->assertEquals(SlaEvaluationService::BREACHED, $fundsSla['status']);
    }

    public function test_11_deposit_sla_business_hours_abstraction(): void
    {
        $user = $this->user();
        $hours = \Mockery::mock(BusinessHoursService::class);
        $hours->shouldReceive('isWithinBusinessHours')->once()->andReturn(true);
        $hours->shouldReceive('isWithinBusinessHours')->once()->andReturn(false);
        $this->app->instance(BusinessHoursService::class, $hours);
        $slaSvc = new SlaEvaluationService($hours);

        $dep = DepositRequest::create([
            'user_id' => $user->id,
            'amount' => 50000,
            'method' => 'transfer',
            'status' => 'pending',
        ]);
        $dep->forceFill(['created_at' => now()->subMinutes(20)])->save();
        $sla = $slaSvc->forDeposit($dep->fresh());
        $this->assertEquals(1800, $sla['target_seconds']);
        $this->assertEquals(SlaEvaluationService::WITHIN, $sla['status']);

        $dep2 = DepositRequest::create([
            'user_id' => $user->id,
            'amount' => 50000,
            'method' => 'transfer',
            'status' => 'pending',
        ]);
        $dep2->forceFill(['created_at' => now()->subHours(1)])->save();
        $sla2 = $slaSvc->forDeposit($dep2->fresh());
        $this->assertEquals(10800, $sla2['target_seconds']);
    }

    public function test_12_13_withdraw_sla_and_breach_flag(): void
    {
        $user = $this->user();
        $w = WithdrawRequest::create([
            'user_id' => $user->id,
            'amount' => 100000,
            'admin_fee' => 0,
            'method' => 'bank',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'account_holder' => 'A',
            'status' => 'pending',
        ]);
        $w->forceFill(['created_at' => now()->subHours(30)])->save();
        $sla = app(SlaEvaluationService::class)->forWithdraw($w->fresh());
        $this->assertEquals(86400, $sla['target_seconds']);
        $this->assertEquals(SlaEvaluationService::BREACHED, $sla['status']);

        $large = WithdrawRequest::create([
            'user_id' => $user->id,
            'amount' => 15000000,
            'admin_fee' => 0,
            'method' => 'bank',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'account_holder' => 'A',
            'status' => 'pending',
        ]);
        $large->forceFill(['created_at' => now()->subHours(30)])->save();
        $slaL = app(SlaEvaluationService::class)->forWithdraw($large->fresh());
        $this->assertEquals(172800, $slaL['target_seconds']);
        $this->assertNotEquals(SlaEvaluationService::BREACHED, $slaL['status']);
    }

    public function test_14_to_16_tax_scaffold_no_calculation(): void
    {
        $scaffold = app(TaxScaffoldService::class)->reportScaffold();
        $this->assertArrayHasKey('pkp_enabled', $scaffold);
        $this->assertArrayHasKey('ppn_amount', $scaffold);
        $this->assertNull($scaffold['ppn_amount']);
        $this->assertNull($scaffold['ppn_rate']);
        $this->assertFalse($scaffold['calculation_applied']);

        TaxSetting::query()->delete();
        TaxSetting::create(['pkp_enabled' => true, 'ppn_rate' => null]);
        $again = app(TaxScaffoldService::class)->reportScaffold();
        $this->assertTrue($again['pkp_enabled']);
        $this->assertNull($again['ppn_amount']);

        $report = app(FinanceReportService::class)->generate([
            'start_date' => now()->startOfMonth()->toDateString(),
            'end_date' => now()->toDateString(),
        ]);
        $this->assertIsArray($report['tax']);
        $this->assertNull($report['tax']['ppn_amount']);
        $this->assertFalse($report['tax']['calculation_applied']);

        $tx = Transaction::create([
            'user_id' => $this->user()->id,
            'invoice_number' => 'S18-TAX-1',
            'service_name' => 'Pulsa',
            'target_number' => '0812',
            'amount' => 1000,
            'admin_fee' => 0,
            'total_payment' => 1000,
            'payment_method' => 'wallet',
            'status' => 'success',
            'tax_ppn_amount' => null,
            'tax_metadata' => null,
        ]);
        $this->assertNull($tx->fresh()->tax_ppn_amount);
    }

    public function test_17_18_retention_guards(): void
    {
        $guard = app(FinancialRetentionGuard::class);
        $user = $this->user();
        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'S18-RET-1',
            'service_name' => 'Pulsa',
            'target_number' => '0812',
            'amount' => 1000,
            'admin_fee' => 0,
            'total_payment' => 1000,
            'payment_method' => 'wallet',
            'status' => 'success',
            'created_at' => now()->subYears(2),
        ]);
        $tx->forceFill(['created_at' => now()->subYears(2)])->save();
        $this->expectException(RuntimeException::class);
        $guard->assertMayDeleteTransaction($tx->fresh());
    }

    public function test_18_kyc_retention_while_active(): void
    {
        $guard = app(FinancialRetentionGuard::class);
        $user = $this->user();
        $kyc = KycVerification::create([
            'user_id' => $user->id,
            'tier' => 2,
            'ktp_full_name' => 'A',
            'ktp_number' => '1234567890123456',
            'ktp_photo_path' => 'kyc/ktp.jpg',
            'selfie_photo_path' => 'kyc/selfie.jpg',
            'bank_name' => 'BCA',
            'bank_account_name' => 'A',
            'bank_account_number' => '1234567890',
            'status' => KycVerification::STATUS_APPROVED,
            'submitted_at' => now(),
        ]);
        $this->expectException(RuntimeException::class);
        $guard->assertMayDeleteKyc($kyc, $user);
    }

    public function test_19_refund_policy_consistent_with_engine_wording(): void
    {
        $html = LegalDocument::where('type', LegalDocument::TYPE_REFUND)->value('content');
        $this->assertStringContainsString('auto', strtolower(strip_tags($html)));
        $this->assertStringContainsString('FAILED', $html);
        $this->assertStringContainsString('REFUNDED', $html);
        $this->assertTrue(class_exists(\App\Services\WalletRefundService::class));
    }
}
