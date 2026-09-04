<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Events\TransactionCreated;
use App\Events\TransactionFailed;
use App\Events\TransactionProcessing;
use App\Events\TransactionSuccess;
use App\Http\Resources\NotificationResource;
use App\Listeners\SendNotification;
use App\Models\MidtransTransaction;
use App\Models\Notification;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\MidtransService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

/**
 * FR-TOPUP-UX-01 — Top Up notification + payment resume UX (no financial credit changes).
 */
class TopUpNotificationUxTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'TopUp UX User',
            'email' => 'topup-ux@gurkynet.test',
            'phone_number' => '081299990301',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W90301',
            'balance' => 100000,
            'status' => 'active',
        ]);
    }

    protected function makeTopUp(array $overrides = []): Transaction
    {
        $tx = Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-TOPUP-'.now()->format('YmdHis').'-9999',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::PENDING->value,
            'notes' => 'Top up saldo via Midtrans (qris/qris)',
        ], $overrides));

        MidtransTransaction::create([
            'transaction_id' => $tx->id,
            'order_id' => $tx->invoice_number,
            'snap_token' => 'snap-ux-token',
            'gross_amount' => $tx->total_payment,
            'transaction_status' => 'pending',
            'payment_type' => 'qris',
        ]);

        return $tx->fresh(['user', 'midtransTransaction']);
    }

    public function test_a_created_does_not_create_notification(): void
    {
        $tx = $this->makeTopUp();
        $before = Notification::count();

        resolve(SendNotification::class)->handle(new TransactionCreated($tx));

        $this->assertSame($before, Notification::count());
        $this->assertDatabaseMissing('notifications', ['title' => 'Menunggu Pembayaran']);
    }

    public function test_b_processing_does_not_create_notification(): void
    {
        $tx = $this->makeTopUp();
        $before = Notification::count();

        resolve(SendNotification::class)->handle(new TransactionProcessing($tx));

        $this->assertSame($before, Notification::count());
        $this->assertDatabaseMissing('notifications', ['title' => 'Pembayaran Diproses']);
    }

    public function test_c_success_creates_exactly_one_notification(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::SUCCESS->value]);
        $this->wallet->balance = 1820000;
        $this->wallet->save();

        resolve(SendNotification::class)->handle(new TransactionSuccess($tx->fresh(['user'])));

        $this->assertSame(1, Notification::where('title', 'Top Up Berhasil')->count());
        $notif = Notification::where('title', 'Top Up Berhasil')->first();
        $this->assertNotNull($notif);
        $this->assertStringContainsString('Rp10.000', $notif->message);
        $this->assertStringContainsString('Rp1.820.000', $notif->message);
        $this->assertSame($tx->id, $notif->payload['transaction_id'] ?? null);
        $this->assertSame($tx->invoice_number, $notif->payload['invoice_number'] ?? null);
        $this->assertSame('topup_success:'.$tx->id, $notif->dedupe_key);
        $this->assertSame('topup_success:'.$tx->id, $notif->payload['dedupe_key'] ?? null);
    }

    public function test_d_duplicate_success_stays_one_notification(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::SUCCESS->value]);
        $listener = resolve(SendNotification::class);
        $listener->handle(new TransactionSuccess($tx->fresh(['user'])));
        $listener->handle(new TransactionSuccess($tx->fresh(['user'])));
        $listener->handle(new TransactionSuccess($tx->fresh(['user'])));

        $this->assertSame(1, Notification::where('title', 'Top Up Berhasil')->count());
        $this->assertSame(1, Notification::where('dedupe_key', 'topup_success:'.$tx->id)->count());
        $this->assertSame(1, UserNotification::where('user_id', $this->user->id)->count());
    }

    public function test_d2_service_level_retry_same_dedupe_key_is_idempotent(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::SUCCESS->value]);
        $payload = [
            'transaction_id' => $tx->id,
            'invoice_number' => $tx->invoice_number,
            'dedupe_key' => 'topup_success:'.$tx->id,
        ];
        $svc = resolve(\App\Services\NotificationService::class);

        $svc->send($this->user, 'Top Up Berhasil', 'Top Up Rp10.000 berhasil.', 'transaction_success', ['database'], $payload);
        $svc->send($this->user, 'Top Up Berhasil', 'Top Up Rp10.000 berhasil.', 'transaction_success', ['database'], $payload);
        $svc->send($this->user, 'Top Up Berhasil', 'Top Up Rp10.000 berhasil. retry', 'transaction_success', ['database'], $payload);

        $this->assertSame(1, Notification::where('dedupe_key', 'topup_success:'.$tx->id)->count());
        $this->assertSame(1, UserNotification::where('user_id', $this->user->id)->count());
    }

    public function test_d3_different_transactions_get_separate_notifications(): void
    {
        $a = $this->makeTopUp(['status' => TransactionStatus::SUCCESS->value, 'invoice_number' => 'TRX-TOPUP-20260904160000-1111']);
        $b = $this->makeTopUp(['status' => TransactionStatus::SUCCESS->value, 'invoice_number' => 'TRX-TOPUP-20260904160000-2222']);

        resolve(SendNotification::class)->handle(new TransactionSuccess($a->fresh(['user'])));
        resolve(SendNotification::class)->handle(new TransactionSuccess($b->fresh(['user'])));

        $this->assertSame(1, Notification::where('dedupe_key', 'topup_success:'.$a->id)->count());
        $this->assertSame(1, Notification::where('dedupe_key', 'topup_success:'.$b->id)->count());
        $this->assertSame(2, Notification::where('title', 'Top Up Berhasil')->count());
    }

    public function test_d4_without_dedupe_key_still_creates_each_time(): void
    {
        $svc = resolve(\App\Services\NotificationService::class);
        $svc->send($this->user, 'Info Biasa', 'Pesan satu', 'info', ['database']);
        $svc->send($this->user, 'Info Biasa', 'Pesan dua', 'info', ['database']);

        $this->assertSame(2, Notification::where('title', 'Info Biasa')->whereNull('dedupe_key')->count());
        $this->assertSame(2, UserNotification::where('user_id', $this->user->id)->count());
    }

    public function test_d5_unique_constraint_rejects_raw_duplicate_insert(): void
    {
        Notification::create([
            'title' => 'Top Up Berhasil',
            'message' => 'first',
            'type' => 'transaction_success',
            'dedupe_key' => 'topup_success:lock-test',
            'payload' => ['dedupe_key' => 'topup_success:lock-test'],
        ]);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        Notification::create([
            'title' => 'Top Up Berhasil',
            'message' => 'second',
            'type' => 'transaction_success',
            'dedupe_key' => 'topup_success:lock-test',
            'payload' => ['dedupe_key' => 'topup_success:lock-test'],
        ]);
    }

    public function test_e_failed_creates_one_final_notification(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::FAILED->value]);
        resolve(SendNotification::class)->handle(new TransactionFailed($tx->fresh(['user'])));

        $this->assertSame(1, Notification::where('title', 'Top Up Gagal')->count());
        $notif = Notification::where('title', 'Top Up Gagal')->first();
        $this->assertSame('topup_failed:'.$tx->id, $notif->payload['dedupe_key'] ?? null);
    }

    public function test_f_expired_creates_kedaluwarsa_notification(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::EXPIRED->value]);
        resolve(SendNotification::class)->handle(new TransactionFailed($tx->fresh(['user'])));

        $this->assertSame(1, Notification::where('title', 'Pembayaran Kedaluwarsa')->count());
        $notif = Notification::where('title', 'Pembayaran Kedaluwarsa')->first();
        $this->assertSame('topup_expired:'.$tx->id, $notif->payload['dedupe_key'] ?? null);
        $this->assertSame('Pembayaran Rp10.000 telah kedaluwarsa.', $notif->message);
        $this->assertStringNotContainsStringIgnoringCase('saldo Anda tidak berubah', $notif->message);
        $this->assertStringNotContainsStringIgnoringCase('midtrans', $notif->message);
    }

    public function test_g_notification_resource_exposes_transaction_reference(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::SUCCESS->value]);
        resolve(SendNotification::class)->handle(new TransactionSuccess($tx->fresh(['user'])));

        $userNotif = UserNotification::where('user_id', $this->user->id)->with('notification')->first();
        $arr = (new NotificationResource($userNotif))->resolve();

        $this->assertSame((string) $tx->id, $arr['transactionId']);
        $this->assertSame($tx->invoice_number, $arr['invoiceNumber']);
        $this->assertSame('transaction_success', $arr['rawType']);
    }

    public function test_m_pending_topup_detail_exposes_resume_snap_token(): void
    {
        $tx = $this->makeTopUp([
            'status' => TransactionStatus::PROCESSING->value,
            'notes' => 'Menunggu penyelesaian pembayaran di Midtrans.',
        ]);
        Sanctum::actingAs($this->user);

        $res = $this->getJson('/api/v1/transactions/'.$tx->id);

        $res->assertOk();
        $res->assertJsonPath('data.paymentResume.canResume', true);
        $res->assertJsonPath('data.paymentResume.snapToken', 'snap-ux-token');
        $this->assertSame('processing', $res->json('data.status'));
        $this->assertSame('QRIS', $res->json('data.paymentMethod'));
        $this->assertSame('QRIS', $res->json('data.paymentMethodLabel'));
        $this->assertNotEquals('midtrans', strtolower((string) $res->json('data.paymentMethod')));
        $notes = (string) $res->json('data.notes');
        $this->assertStringNotContainsStringIgnoringCase('midtrans', $notes);
        $this->assertStringNotContainsStringIgnoringCase('provider', $notes);
        $this->assertStringContainsString('Menunggu pembayaran', $notes);
        $resume = $res->json('data.paymentResume');
        $this->assertSame(['canResume', 'snapToken'], array_keys($resume));
        $this->assertArrayNotHasKey('orderId', $resume);
        $this->assertArrayNotHasKey('midtransStatus', $resume);
        $this->assertArrayNotHasKey('reason', $resume);
    }

    public function test_m2_empty_midtrans_status_still_resumable(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::PENDING->value]);
        MidtransTransaction::where('transaction_id', $tx->id)->update([
            'transaction_status' => '',
        ]);
        Sanctum::actingAs($this->user);

        $res = $this->getJson('/api/v1/transactions/'.$tx->id);
        $res->assertOk();
        $res->assertJsonPath('data.paymentResume.canResume', true);
        $res->assertJsonPath('data.paymentResume.snapToken', 'snap-ux-token');
        $resume = $res->json('data.paymentResume');
        $this->assertSame(['canResume', 'snapToken'], array_keys($resume));
    }

    public function test_n_expired_topup_cannot_resume(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::EXPIRED->value]);
        MidtransTransaction::where('transaction_id', $tx->id)->update(['transaction_status' => 'expire']);
        Sanctum::actingAs($this->user);

        $res = $this->getJson('/api/v1/transactions/'.$tx->id);

        $res->assertOk();
        $res->assertJsonPath('data.paymentResume.canResume', false);
        $res->assertJsonPath('data.paymentResume.snapToken', null);
        $this->assertSame('expired', $res->json('data.status'));
        $resume = $res->json('data.paymentResume');
        $this->assertSame(['canResume', 'snapToken'], array_keys($resume));
        $this->assertArrayNotHasKey('orderId', $resume);
        $this->assertArrayNotHasKey('midtransStatus', $resume);
        $this->assertArrayNotHasKey('reason', $resume);
    }

    public function test_o_success_topup_cannot_resume(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::SUCCESS->value]);
        MidtransTransaction::where('transaction_id', $tx->id)->update(['transaction_status' => 'settlement']);
        Sanctum::actingAs($this->user);

        $res = $this->getJson('/api/v1/transactions/'.$tx->id);

        $res->assertOk();
        $res->assertJsonPath('data.paymentResume.canResume', false);
        $res->assertJsonPath('data.paymentResume.snapToken', null);
        $resume = $res->json('data.paymentResume');
        $this->assertSame(['canResume', 'snapToken'], array_keys($resume));
        $this->assertArrayNotHasKey('orderId', $resume);
        $this->assertArrayNotHasKey('midtransStatus', $resume);
        $this->assertArrayNotHasKey('reason', $resume);
    }

    public function test_p_other_user_cannot_resume_or_view_token(): void
    {
        $tx = $this->makeTopUp();
        $other = User::create([
            'name' => 'Other',
            'email' => 'other-ux@gurkynet.test',
            'phone_number' => '081299990302',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
        ]);
        Sanctum::actingAs($other);

        $this->getJson('/api/v1/transactions/'.$tx->id)->assertStatus(404);
    }

    public function test_list_does_not_expose_payment_resume(): void
    {
        $this->makeTopUp();
        Sanctum::actingAs($this->user);

        $res = $this->getJson('/api/v1/transactions');
        $res->assertOk();
        $first = $res->json('data.0');
        $this->assertArrayNotHasKey('paymentResume', $first ?? []);
    }

    public function test_sync_payment_pending_stays_pending_and_resumable(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::PENDING->value, 'amount' => 15000, 'total_payment' => 15000]);
        MidtransTransaction::where('transaction_id', $tx->id)->update(['gross_amount' => 15000]);
        Sanctum::actingAs($this->user);

        // Override TestCase Midtrans HTTP default (settlement) with authoritative pending.
        $midtrans = Mockery::mock(MidtransService::class)->makePartial();
        $midtrans->shouldReceive('isConfigured')->andReturn(true);
        $midtrans->shouldReceive('checkStatus')
            ->once()
            ->with($tx->invoice_number)
            ->andReturn([
                'order_id' => $tx->invoice_number,
                'status_code' => '201',
                'gross_amount' => '15000.00',
                'transaction_status' => 'pending',
            ]);
        $this->app->instance(MidtransService::class, $midtrans);

        $res = $this->postJson('/api/v1/transactions/'.$tx->id.'/sync-payment');
        $res->assertOk();
        $this->assertContains($res->json('data.status'), ['pending', 'processing']);
        $res->assertJsonPath('data.paymentResume.canResume', true);
        $res->assertJsonPath('data.paymentResume.snapToken', 'snap-ux-token');
        $resume = $res->json('data.paymentResume');
        $this->assertSame(['canResume', 'snapToken'], array_keys($resume));
        $this->assertArrayNotHasKey('orderId', $resume);
        $this->assertArrayNotHasKey('midtransStatus', $resume);
        $this->assertArrayNotHasKey('reason', $resume);
        $this->assertEquals(100000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('wallet_id', $this->wallet->id)->count());
    }

    public function test_sync_payment_expire_becomes_expired_no_credit_one_notification(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::PENDING->value, 'amount' => 15000, 'total_payment' => 15000]);
        MidtransTransaction::where('transaction_id', $tx->id)->update(['gross_amount' => 15000]);
        Sanctum::actingAs($this->user);

        $midtrans = Mockery::mock(MidtransService::class)->makePartial();
        $midtrans->shouldReceive('isConfigured')->andReturn(true);
        $midtrans->shouldReceive('checkStatus')
            ->once()
            ->with($tx->invoice_number)
            ->andReturn([
                'order_id' => $tx->invoice_number,
                'status_code' => '407',
                'gross_amount' => '15000.00',
                'transaction_status' => 'expire',
            ]);
        $this->app->instance(MidtransService::class, $midtrans);

        $res = $this->postJson('/api/v1/transactions/'.$tx->id.'/sync-payment');
        $res->assertOk();
        $this->assertSame('expired', $res->json('data.status'));
        $res->assertJsonPath('data.paymentResume.canResume', false);
        $res->assertJsonPath('data.paymentResume.snapToken', null);
        $notes = (string) $res->json('data.notes');
        $this->assertSame('Pembayaran Rp15.000 telah kedaluwarsa.', $notes);
        $this->assertStringNotContainsStringIgnoringCase('midtrans', $notes);
        $this->assertStringNotContainsStringIgnoringCase('provider', $notes);
        $this->assertStringNotContainsStringIgnoringCase('saldo Anda tidak berubah', $notes);
        $this->assertStringNotContainsString('Menunggu pembayaran', $notes);

        $this->assertEquals(100000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('wallet_id', $this->wallet->id)->count());
        $this->assertSame(1, Notification::where('title', 'Pembayaran Kedaluwarsa')->count());
        $notif = Notification::where('title', 'Pembayaran Kedaluwarsa')->first();
        $this->assertSame('Pembayaran Rp15.000 telah kedaluwarsa.', $notif->message);

        // Duplicate expire sync — terminal skip (no second Midtrans call), no second notification.
        $res2 = $this->postJson('/api/v1/transactions/'.$tx->id.'/sync-payment');
        $res2->assertOk();
        $this->assertSame('expired', $res2->json('data.status'));
        $this->assertSame(1, Notification::where('title', 'Pembayaran Kedaluwarsa')->count());
        $this->assertEquals(100000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_sync_payment_settlement_becomes_success(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::PENDING->value, 'amount' => 15000, 'total_payment' => 15000]);
        MidtransTransaction::where('transaction_id', $tx->id)->update(['gross_amount' => 15000]);
        Sanctum::actingAs($this->user);

        $midtrans = Mockery::mock(MidtransService::class)->makePartial();
        $midtrans->shouldReceive('isConfigured')->andReturn(true);
        $midtrans->shouldReceive('checkStatus')
            ->once()
            ->with($tx->invoice_number)
            ->andReturn([
                'order_id' => $tx->invoice_number,
                'status_code' => '200',
                'gross_amount' => '15000.00',
                'transaction_status' => 'settlement',
            ]);
        $this->app->instance(MidtransService::class, $midtrans);

        $res = $this->postJson('/api/v1/transactions/'.$tx->id.'/sync-payment');
        $res->assertOk();
        $this->assertSame('success', $res->json('data.status'));
        $res->assertJsonPath('data.paymentResume.canResume', false);
        $this->assertEquals(115000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('wallet_id', $this->wallet->id)->where('type', WalletMutation::TYPE_TOPUP)->count());
    }

    public function test_snap_create_includes_gurkynet_finish_callback_not_example_domain(): void
    {
        config(['services.frontend_url' => 'https://gurkynet.my.id']);

        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::response([
                'token' => 'snap-finish-url-token',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-finish-url-token',
            ], 201),
            'https://app.sandbox.midtrans.com/*' => Http::response([
                'token' => 'snap-finish-url-token',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-finish-url-token',
            ], 201),
        ]);

        $finishUrl = 'https://gurkynet.my.id/dashboard/riwayat/42';
        app(MidtransService::class)->createSnapTransaction(
            'TRX-TOPUP-FINISH-URL-1',
            15000,
            ['first_name' => 'Test'],
            [],
            ['finish_redirect_url' => $finishUrl, 'enabled_payments' => ['qris']]
        );

        Http::assertSent(function ($request) use ($finishUrl) {
            if (! str_contains($request->url(), '/snap/v1/transactions')) {
                return false;
            }
            $data = $request->data();
            $finish = $data['callbacks']['finish'] ?? null;
            $serialized = json_encode($data);

            return $finish === $finishUrl
                && ! str_contains((string) $serialized, 'example.com')
                && ! str_contains((string) $finish, 'snap_token')
                && ! str_contains((string) $finish, 'server_key');
        });
    }

    public function test_payment_method_label_qris(): void
    {
        $tx = $this->makeTopUp(['notes' => 'Top up saldo via Midtrans (qris/qris)']);
        Sanctum::actingAs($this->user);

        $res = $this->getJson('/api/v1/transactions/'.$tx->id);
        $res->assertOk();
        $this->assertSame('QRIS', $res->json('data.paymentMethod'));
        $this->assertSame('QRIS', $res->json('data.paymentMethodLabel'));
        $this->assertStringNotContainsStringIgnoringCase('midtrans', (string) $res->json('data.paymentMethod'));
    }

    public function test_payment_method_label_va_bri_and_bca(): void
    {
        Sanctum::actingAs($this->user);

        $bri = $this->makeTopUp([
            'invoice_number' => 'TRX-TOPUP-BRI-LABEL-1',
            'notes' => 'Top up saldo via Midtrans (va/bri_va)',
        ]);
        MidtransTransaction::where('transaction_id', $bri->id)->update(['payment_type' => 'bri_va']);
        $this->getJson('/api/v1/transactions/'.$bri->id)
            ->assertOk()
            ->assertJsonPath('data.paymentMethod', 'Virtual Account BRI')
            ->assertJsonPath('data.paymentMethodLabel', 'Virtual Account BRI');

        $bca = $this->makeTopUp([
            'invoice_number' => 'TRX-TOPUP-BCA-LABEL-1',
            'notes' => 'Top up saldo via Midtrans (va/bca_va)',
        ]);
        MidtransTransaction::where('transaction_id', $bca->id)->update(['payment_type' => 'bca_va']);
        $this->getJson('/api/v1/transactions/'.$bca->id)
            ->assertOk()
            ->assertJsonPath('data.paymentMethod', 'Virtual Account BCA')
            ->assertJsonPath('data.paymentMethodLabel', 'Virtual Account BCA');
    }

    public function test_payment_method_label_indomaret_and_gopay_from_midtrans_payload(): void
    {
        Sanctum::actingAs($this->user);

        $indo = $this->makeTopUp([
            'invoice_number' => 'TRX-TOPUP-INDO-LABEL-1',
            'notes' => 'legacy topup without channel note',
        ]);
        MidtransTransaction::where('transaction_id', $indo->id)->update([
            'payment_type' => 'cstore',
            'raw_notification' => [
                'payment_type' => 'cstore',
                'store' => 'indomaret',
                'transaction_status' => 'pending',
            ],
        ]);
        $this->getJson('/api/v1/transactions/'.$indo->id)
            ->assertOk()
            ->assertJsonPath('data.paymentMethod', 'Indomaret');

        $gopay = $this->makeTopUp([
            'invoice_number' => 'TRX-TOPUP-GOPAY-LABEL-1',
            'notes' => 'legacy topup without channel note',
        ]);
        MidtransTransaction::where('transaction_id', $gopay->id)->update([
            'payment_type' => 'gopay',
            'raw_notification' => [
                'payment_type' => 'gopay',
                'transaction_status' => 'settlement',
            ],
        ]);
        $this->getJson('/api/v1/transactions/'.$gopay->id)
            ->assertOk()
            ->assertJsonPath('data.paymentMethod', 'GoPay')
            ->assertJsonPath('data.paymentMethodLabel', 'GoPay');
    }

    public function test_payment_method_never_exposes_midtrans_gateway_name(): void
    {
        $tx = $this->makeTopUp([
            'notes' => null,
        ]);
        MidtransTransaction::where('transaction_id', $tx->id)->update([
            'payment_type' => null,
            'raw_notification' => null,
        ]);
        Sanctum::actingAs($this->user);

        $res = $this->getJson('/api/v1/transactions/'.$tx->id);
        $res->assertOk();
        $method = strtolower((string) $res->json('data.paymentMethod'));
        $label = strtolower((string) $res->json('data.paymentMethodLabel'));
        $this->assertNotEquals('midtrans', $method);
        $this->assertNotEquals('midtrans', $label);
        $this->assertSame('Pembayaran', $res->json('data.paymentMethod'));
        // Resume still works for pending with snap token.
        $res->assertJsonPath('data.paymentResume.canResume', true);
    }
}
