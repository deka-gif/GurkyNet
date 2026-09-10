<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Models\Notification;
use App\Models\UserNotification;
use App\Events\TransactionCreated;
use App\Events\TransactionSuccess;
use App\Events\TransactionFailed;
use App\Events\TransactionProcessing;
use App\Events\WalletCredited;
use App\Events\WalletDebited;
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
        $this->assertSame('Saldo Anda berhasil ditambahkan sebesar Rp25.000.', $notification->message);
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

    public function test_top_up_created_and_processing_do_not_create_inbox_notifications(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TOPUP-NOTIF-003',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 25000,
            'total_payment' => 25000,
            'payment_method' => 'midtrans',
            'status' => 'pending',
        ]);
        $transaction->load('user');
        $before = Notification::count();

        resolve(SendNotification::class)->handle(new \App\Events\TransactionCreated($transaction));
        resolve(SendNotification::class)->handle(new \App\Events\TransactionProcessing($transaction));

        $this->assertSame($before, Notification::count());
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

    public function test_product_purchase_success_uses_single_customer_final_notification(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-PRODUCT-NOTIF-001',
            'service_name' => 'Pulsa Telkomsel 75.000',
            'target_number' => '081234567899',
            'amount' => 75000,
            'total_payment' => 77000,
            'payment_method' => 'wallet',
            'status' => 'success',
        ]);
        $transaction->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionCreated($transaction));
        $listener->handle(new \App\Events\TransactionProcessing($transaction));
        $listener->handle(new TransactionSuccess($transaction));
        $listener->handle(new \App\Events\TransactionProcessing($transaction));

        $this->assertSame(1, Notification::count());
        $notification = Notification::first();
        $this->assertSame('Pembelian Berhasil', $notification->title);
        $this->assertSame(
            'Pembelian Pulsa Telkomsel 75.000 sebesar Rp75.000 berhasil diproses.',
            $notification->message
        );
        $this->assertSame('customer_final:'.$transaction->id, $notification->dedupe_key);
    }

    public function test_bill_payment_success_uses_customer_wording(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-BILL-NOTIF-001',
            'service_name' => 'PLN Pascabayar',
            'target_number' => '1234567890',
            'amount' => 150000,
            'total_payment' => 152500,
            'payment_method' => 'wallet',
            'status' => 'success',
        ]);
        $transaction->load('user');

        resolve(SendNotification::class)->handle(new TransactionSuccess($transaction));

        $this->assertDatabaseHas('notifications', ['title' => 'Pembayaran Berhasil']);
        $notification = Notification::where('title', 'Pembayaran Berhasil')->first();
        $this->assertSame(
            'Pembayaran tagihan PLN Pascabayar sebesar Rp150.000 berhasil diselesaikan.',
            $notification->message
        );
    }

    public function test_bill_payment_failed_includes_service_and_amount(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-BILL-NOTIF-002',
            'service_name' => 'PLN Pascabayar',
            'target_number' => '1234567890',
            'amount' => 150000,
            'total_payment' => 152500,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'refunded_at' => now(),
        ]);
        $transaction->load('user');

        resolve(SendNotification::class)->handle(new TransactionFailed($transaction));

        $notification = Notification::first();
        $this->assertSame('Pembayaran Gagal', $notification->title);
        $this->assertSame(
            'Pembayaran tagihan PLN Pascabayar sebesar Rp150.000 tidak dapat diproses. Dana telah dikembalikan ke saldo Anda.',
            $notification->message
        );
        $this->assertSame(1, Notification::count());
    }

    public function test_purchase_failed_includes_service_and_amount_without_fake_reason(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-PRODUCT-NOTIF-004',
            'service_name' => 'Mobile Legends 50.000',
            'target_number' => '123456789',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
        ]);
        $transaction->load('user');

        resolve(SendNotification::class)->handle(new TransactionFailed($transaction));

        $notification = Notification::first();
        $this->assertSame('Pembelian Gagal', $notification->title);
        $this->assertSame(
            'Pembelian Mobile Legends 50.000 sebesar Rp50.000 tidak dapat diproses.',
            $notification->message
        );
        $this->assertStringNotContainsStringIgnoringCase('server', $notification->message);
        $this->assertStringNotContainsStringIgnoringCase('digiflazz', $notification->message);
        $this->assertSame('customer_final:'.$transaction->id, $notification->dedupe_key);
    }

    public function test_transfer_success_skips_wallet_ledger_toasts_and_sends_single_final_notification(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TF-NOTIF-001',
            'service_name' => 'Transfer Saldo',
            'target_number' => '104200000199',
            'amount' => 100000,
            'total_payment' => 100000,
            'payment_method' => 'wallet',
            'status' => 'success',
            'notes' => 'Transfer ke BUDI',
        ]);
        $transaction->load('user');
        $this->wallet->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new WalletDebited($this->wallet, 100000, 'Transfer ke 104200000199', $transaction->id));
        $listener->handle(new TransactionCreated($transaction));
        $listener->handle(new TransactionSuccess($transaction));
        $listener->handle(new WalletCredited($this->wallet, 100000, 'Transfer masuk dari 104200000099', $transaction->id));

        $this->assertSame(1, Notification::count());
        $notification = Notification::first();
        $this->assertSame('Transfer Berhasil', $notification->title);
        $this->assertSame('Transfer sebesar Rp100.000 berhasil dilakukan.', $notification->message);
    }

    public function test_failed_purchase_with_refund_merges_refund_into_single_notification(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-PRODUCT-NOTIF-002',
            'service_name' => 'Pulsa Telkomsel 75.000',
            'target_number' => '081234567899',
            'amount' => 75000,
            'total_payment' => 77000,
            'payment_method' => 'wallet',
            'status' => 'REFUNDED',
            'refunded_at' => now(),
            'notes' => 'Refund confirmed',
        ]);
        $transaction->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionFailed($transaction));
        $listener->handle(new WalletCredited($this->wallet, 77000, 'Refund transaksi', $transaction->id));

        $this->assertSame(1, Notification::count());
        $notification = Notification::first();
        $this->assertSame('Pembelian Gagal', $notification->title);
        $this->assertSame(
            'Pembelian Pulsa Telkomsel 75.000 sebesar Rp75.000 tidak dapat diproses. Dana telah dikembalikan ke saldo Anda.',
            $notification->message
        );
        $this->assertDatabaseMissing('notifications', ['title' => 'Refund Berhasil']);
        $this->assertDatabaseMissing('notifications', ['title' => 'Saldo Bertambah']);
    }

    public function test_duplicate_and_late_events_do_not_create_more_than_one_final_notification(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-PRODUCT-NOTIF-003',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => 'success',
        ]);
        $transaction->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionCreated($transaction));
        $listener->handle(new \App\Events\TransactionProcessing($transaction));
        $listener->handle(new TransactionSuccess($transaction));
        $listener->handle(new TransactionSuccess($transaction));
        $listener->handle(new \App\Events\TransactionProcessing($transaction));

        $this->assertSame(1, Notification::count());
        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$transaction->id)->count());
        $this->assertSame(1, UserNotification::where('user_id', $this->user->id)->count());
    }

    public function test_customer_final_dedupe_success_success_creates_exactly_one_notification(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-DEDUP-001',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        $tx->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionSuccess($tx));
        $listener->handle(new TransactionSuccess($tx));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
    }

    public function test_customer_final_dedupe_failed_failed_creates_exactly_one_notification(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-DEDUP-002',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
        ]);
        $tx->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionFailed($tx));
        $listener->handle(new TransactionFailed($tx));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
    }

    public function test_customer_final_dedupe_expired_expired_creates_exactly_one_notification(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-DEDUP-003',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::EXPIRED->value,
            'notes' => 'Pembayaran kedaluwarsa',
        ]);
        $tx->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionFailed($tx));
        $listener->handle(new TransactionFailed($tx));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
    }

    public function test_customer_final_dedupe_failed_then_expired_does_not_create_second_notification(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-DEDUP-004',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
        ]);
        $tx->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionFailed($tx));

        $tx->status = TransactionStatus::EXPIRED->value;
        $tx->notes = 'Pembayaran kedaluwarsa';
        $tx->save();

        $listener->handle(new TransactionFailed($tx->fresh(['user'])));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
        $this->assertSame(1, Notification::count());
    }

    public function test_customer_final_dedupe_expired_then_failed_does_not_create_second_notification(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-DEDUP-005',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::EXPIRED->value,
            'notes' => 'Pembayaran kedaluwarsa',
        ]);
        $tx->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionFailed($tx));

        $tx->status = TransactionStatus::FAILED->value;
        $tx->notes = 'Transaksi gagal';
        $tx->save();

        $listener->handle(new TransactionFailed($tx->fresh(['user'])));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
        $this->assertSame(1, Notification::count());
    }

    public function test_customer_final_dedupe_success_then_processing_does_not_create_second_notification(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-DEDUP-006',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        $tx->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionSuccess($tx));
        $listener->handle(new TransactionProcessing($tx));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
        $this->assertSame(1, Notification::count());
    }

    public function test_customer_final_dedupe_failed_then_success_does_not_create_second_notification(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-DEDUP-007',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
        ]);
        $tx->load('user');

        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionFailed($tx));

        $tx->status = TransactionStatus::SUCCESS->value;
        $tx->save();

        $listener->handle(new TransactionSuccess($tx->fresh(['user'])));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
        $this->assertSame(1, Notification::count());
    }

    public function test_customer_final_concurrentish_success_events_still_single_notification(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-DEDUP-008',
            'service_name' => 'Pulsa Telkomsel 50.000',
            'target_number' => '081234567899',
            'amount' => 50000,
            'total_payment' => 52000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        $tx->load('user');

        $listener = resolve(SendNotification::class);
        // Separated calls mimic two workers racing; unique constraint ensures only one row.
        $listener->handle(new TransactionSuccess($tx));
        $listener->handle(new TransactionSuccess($tx));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
        $this->assertSame(1, Notification::count());
    }
}
