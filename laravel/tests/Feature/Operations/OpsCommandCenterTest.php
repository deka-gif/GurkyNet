<?php

namespace Tests\Feature\Operations;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Jobs\ProcessDigiflazzTransaction;
use App\Models\OpsAlert;
use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workflow;
use App\Models\WorkflowEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OpsCommandCenterTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(UserRole $role, string $prefix = 'u'): User
    {
        return User::create([
            'name' => $role->label(),
            'email' => $prefix.'-'.uniqid().'@gurkypay.com',
            'phone_number' => '081'.random_int(100000000, 999999999),
            'password' => Hash::make('password123'),
            'role' => $role,
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    public function test_cs_escalate_ops_issue_detail_includes_transaction_snapshot(): void
    {
        $user = $this->makeUser(UserRole::USER, 'cust');
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops');

        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV/OPS/'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'fulfillment_provider_code' => 'digiflazz',
            'provider_sku_used' => 'pulsa10',
            'provider_response' => ['rc' => '02', 'message' => 'timeout', 'request' => ['sku' => 'pulsa10']],
            'provider_last_status' => '02',
        ]);

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Provider timeout',
            'targetDivision' => 'operations',
            'transactionId' => $tx->id,
            'type' => 'provider_issue',
            'category' => 'api_failure',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($ops);
        $detail = $this->getJson("/api/v1/admin/operations/issues/{$wfId}")->assertOk()->json('data');

        $this->assertArrayHasKey('opsDetail', $detail);
        $this->assertSame('02', $detail['opsDetail']['transaction']['rc'] ?? null);
        $this->assertSame('digiflazz', $detail['opsDetail']['transaction']['providerCode'] ?? null);
        $this->assertSame('pulsa10', $detail['opsDetail']['transaction']['sku'] ?? null);
        $this->assertSame($tx->invoice_number, $detail['opsDetail']['transaction']['invoice'] ?? null);
    }

    public function test_ops_need_refund_escalates_to_finance_queue(): void
    {
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs2');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops2');
        $fin = $this->makeUser(UserRole::FINANCE, 'fin2');

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Failed after retries',
            'targetDivision' => 'operations',
            'type' => 'provider_issue',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($ops);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'need_refund',
            'note' => 'Cannot fulfill — escalate refund',
        ])->assertOk();

        $wf = Workflow::find($wfId);
        $this->assertSame('finance', $wf->current_division);
        $this->assertSame('waiting_finance', $wf->status);
        $this->assertSame('refund_request', $wf->category);

        Sanctum::actingAs($fin);
        $list = $this->getJson('/api/v1/admin/workflows?division=finance')->assertOk()->json('data.data');
        $this->assertTrue(collect($list)->contains(fn ($w) => $w['id'] === $wfId));
    }

    public function test_ops_retry_intent_does_not_push_digiflazz_job(): void
    {
        Queue::fake();

        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs3');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops3');

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Retry intent',
            'targetDivision' => 'operations',
            'type' => 'provider_issue',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($ops);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'retry',
            'note' => 'Safe hook only',
        ])->assertOk();

        Queue::assertNotPushed(ProcessDigiflazzTransaction::class);
        $this->assertTrue(
            WorkflowEvent::query()
                ->where('workflow_id', $wfId)
                ->where('action', 'retry_intent')
                ->exists()
        );
    }

    public function test_ops_alerts_evaluate_and_lifecycle(): void
    {
        ProductProvider::query()->create([
            'code' => 'ops-offline-'.uniqid(),
            'name' => 'Offline Provider',
            'is_active' => true,
            'partner_status' => 'offline',
            'health_color' => 'red',
            'sort_order' => 99,
            'priority' => 99,
        ]);

        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops4');
        Sanctum::actingAs($ops);

        $this->postJson('/api/v1/admin/operations/alerts/evaluate')->assertOk();

        $alert = OpsAlert::query()->where('type', 'provider_offline')->where('status', 'open')->first();
        $this->assertNotNull($alert);

        $this->postJson("/api/v1/admin/operations/alerts/{$alert->id}/ack")->assertOk();
        $this->assertSame('acknowledged', $alert->fresh()->status);

        $this->postJson("/api/v1/admin/operations/alerts/{$alert->id}/investigate")->assertOk();
        $this->assertSame('investigating', $alert->fresh()->status);

        $this->postJson("/api/v1/admin/operations/alerts/{$alert->id}/resolve")->assertOk();
        $this->assertSame('resolved', $alert->fresh()->status);

        $this->postJson("/api/v1/admin/operations/alerts/{$alert->id}/close")->assertOk();
        $this->assertSame('closed', $alert->fresh()->status);
    }

    public function test_infra_monitoring_marks_os_metrics_na(): void
    {
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops5');
        Sanctum::actingAs($ops);

        $data = $this->getJson('/api/v1/admin/operations/monitoring/infra')->assertOk()->json('data');

        $this->assertArrayHasKey('redis', $data);
        $this->assertArrayHasKey('database', $data);
        $this->assertSame('na', $data['os']['cpu']['status'] ?? null);
        $this->assertFalse($data['os']['cpu']['available'] ?? true);
        $this->assertSame('na', $data['os']['ram']['status'] ?? null);
        $this->assertSame('na', $data['os']['disk']['status'] ?? null);
    }

    public function test_command_center_kpis_are_numeric(): void
    {
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops6');
        Sanctum::actingAs($ops);

        $data = $this->getJson('/api/v1/admin/operations/command-center')->assertOk()->json('data');
        $kpis = $data['kpis'] ?? [];

        $this->assertIsNumeric($kpis['transactionsToday'] ?? null);
        $this->assertIsNumeric($kpis['successToday'] ?? null);
        $this->assertIsNumeric($kpis['failedToday'] ?? null);
        $this->assertIsNumeric($kpis['successRate'] ?? null);
        $this->assertIsNumeric($kpis['openIssues'] ?? null);
        $this->assertIsNumeric($kpis['incidentsToday'] ?? null);
        $this->assertArrayHasKey('infra', $data);
        $this->assertArrayHasKey('providerHealth', $data);
    }

    public function test_marketing_cs_cannot_patch_ops_alerts_ops_cannot_finance_approve(): void
    {
        $alert = OpsAlert::create([
            'alert_code' => 'OPS-ALT-TEST-0001',
            'type' => 'other',
            'severity' => 'info',
            'title' => 'Test',
            'body' => 'x',
            'status' => 'open',
            'source' => 'manual',
        ]);

        $mkt = $this->makeUser(UserRole::MARKETING, 'mkt');
        Sanctum::actingAs($mkt);
        $this->postJson("/api/v1/admin/operations/alerts/{$alert->id}/ack")->assertStatus(403);

        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs7');
        Sanctum::actingAs($cs);
        $this->postJson("/api/v1/admin/operations/alerts/{$alert->id}/resolve")->assertStatus(403);

        $cs2 = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs8');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops7');

        Sanctum::actingAs($cs2);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Refund gate',
            'targetDivision' => 'finance',
            'type' => 'refund_request',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($ops);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'approve',
            'note' => 'should fail',
        ])->assertStatus(403);

        $this->postJson('/api/v1/admin/finance/alerts/evaluate')->assertStatus(403);
    }
}
