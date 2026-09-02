<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Models\Notification;
use App\Models\UserNotification;
use App\Events\TransactionCreated;
use App\Events\TransactionSuccess;
use App\Events\TransactionFailed;
use App\Events\WalletCredited;
use App\Listeners\SendNotification;
use App\Listeners\WriteAuditLog;
use App\Listeners\BroadcastEvent;
use App\Listeners\AnalyticsCollector;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ObservabilityAndNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Trace Test User',
            'email' => 'tracer@gurkypay.com',
            'phone_number' => '081234567899',
            'password' => Hash::make('password123'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000099',
            'balance' => 100000.00,
            'status' => 'active',
        ]);
    }

    /**
     * Verify that events are registered to listeners correctly.
     */
    public function test_events_are_registered_to_listeners(): void
    {
        Event::fake();

        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TEST-EVENT-001',
            'service_name' => 'Test Service',
            'target_number' => '081234567899',
            'amount' => 5000.00,
            'total_payment' => 5000.00,
            'status' => 'pending',
        ]);

        event(new TransactionCreated($transaction));

        Event::assertDispatched(TransactionCreated::class);
    }

    /**
     * Verify that our listeners implement the ShouldQueue interface.
     */
    public function test_listeners_implement_should_queue(): void
    {
        $this->assertInstanceOf(\Illuminate\Contracts\Queue\ShouldQueue::class, resolve(SendNotification::class));
        $this->assertInstanceOf(\Illuminate\Contracts\Queue\ShouldQueue::class, resolve(WriteAuditLog::class));
        $this->assertInstanceOf(\Illuminate\Contracts\Queue\ShouldQueue::class, resolve(BroadcastEvent::class));
        $this->assertInstanceOf(\Illuminate\Contracts\Queue\ShouldQueue::class, resolve(AnalyticsCollector::class));
    }

    /**
     * Verify that NotificationService successfully creates records across database channels.
     */
    public function test_notification_service_persists_to_database(): void
    {
        $service = resolve(NotificationService::class);
        
        $results = $service->send(
            $this->user,
            'Gaji Masuk',
            'Gaji bulanan Anda telah masuk ke dompet digital.',
            'success',
            ['database']
        );

        $this->assertTrue($results['database']);

        $this->assertDatabaseHas('notifications', [
            'title' => 'Gaji Masuk',
            'message' => 'Gaji bulanan Anda telah masuk ke dompet digital.',
            'type' => 'success',
        ]);

        $notification = Notification::where('title', 'Gaji Masuk')->first();

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->user->id,
            'notification_id' => $notification->id,
            'is_read' => false,
        ]);
    }

    /**
     * Verify Health Endpoint, trace header injection, and schema resilience.
     */
    public function test_health_endpoints_and_tracing_headers(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'status',
            'timestamp',
            'services' => [
                'database',
                'cache',
                'queue',
            ],
            'version'
        ]);

        // Assert Correlation ID and Request ID header injection by middleware
        $response->assertHeader('X-Correlation-ID');
        $response->assertHeader('X-Request-ID');
    }

    /**
     * Verify status endpoint.
     */
    public function test_status_endpoint(): void
    {
        $response = $this->getJson('/api/status');

        $response->assertStatus(200);
        $response->assertJsonFragment([
            'status' => 'healthy',
        ]);
    }

    /**
     * Verify metrics endpoint output metrics.
     */
    public function test_metrics_endpoint(): void
    {
        $response = $this->getJson('/api/metrics');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'queue_length',
            'failed_jobs',
            'average_queue_time_seconds',
            'daily_transactions',
            'daily_revenue',
            'digiflazz_success_rate_percent',
            'midtrans_success_rate_percent',
            'timestamp',
        ]);
    }

    public function test_top_up_success_notification_uses_top_up_berhasil_without_refund_wording(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TOPUP-NOTIF-001',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 25000,
            'total_payment' => 25000,
            'payment_method' => 'midtrans',
            'status' => 'success',
        ]);
        $transaction->load('user');

        resolve(SendNotification::class)->handle(new TransactionSuccess($transaction));

        $this->assertDatabaseHas('notifications', [
            'title' => 'Top Up Berhasil',
        ]);

        $notification = Notification::where('title', 'Top Up Berhasil')->first();
        $this->assertNotNull($notification);
        $this->assertStringNotContainsString('refund', strtolower((string) $notification->message));
    }

    public function test_wallet_credited_for_top_up_settlement_does_not_create_second_notification(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TOPUP-NOTIF-002',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 25000,
            'total_payment' => 25000,
            'payment_method' => 'midtrans',
            'status' => 'success',
        ]);

        $before = Notification::count();

        $this->wallet->load('user');
        resolve(SendNotification::class)->handle(new WalletCredited(
            $this->wallet,
            25000,
            'Top Up settlement',
            $transaction->id
        ));

        $this->assertSame($before, Notification::count());
        $this->assertDatabaseMissing('notifications', [
            'title' => 'Saldo Bertambah',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'title' => 'Refund Berhasil',
        ]);
    }

    public function test_top_up_expired_notification_uses_pembayaran_kedaluwarsa(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TOPUP-NOTIF-003',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 25000,
            'total_payment' => 25000,
            'payment_method' => 'midtrans',
            'status' => \App\Enums\TransactionStatus::EXPIRED->value,
            'notes' => 'Pembayaran kedaluwarsa',
        ]);
        $transaction->load('user');

        resolve(SendNotification::class)->handle(new TransactionFailed($transaction));

        $this->assertDatabaseHas('notifications', [
            'title' => 'Pembayaran Kedaluwarsa',
        ]);
    }
}
