<?php

namespace Tests\Feature;

use App\Enums\AccountDeletionStatus;
use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\AccountDeletionEvent;
use App\Models\DepositRequest;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawRequest;
use App\Services\AccountDeletion\AccountDeletionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Customer account deletion — 30-day grace + anonymize (Owner-approved).
 */
class AccountDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function makeCustomer(array $overrides = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Customer Test',
            'email' => 'cust'.uniqid().'@example.com',
            'phone_number' => '08'.random_int(1000000000, 9999999999),
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'agent',
            'transaction_pin' => Hash::make('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ], $overrides));

        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => 'W'.str_pad((string) $user->id, 10, '0', STR_PAD_LEFT),
            'balance' => 0,
            'status' => 'active',
        ]);

        return $user->fresh(['wallet']);
    }

    private function makeStaff(): User
    {
        return User::create([
            'name' => 'Staff',
            'email' => 'staff'.uniqid().'@example.com',
            'phone_number' => '08'.random_int(1000000000, 9999999999),
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'user_type' => 'staff',
            'transaction_pin' => Hash::make('123456'),
            'email_verified_at' => now(),
        ]);
    }

    public function test_rejects_when_wallet_balance_not_zero(): void
    {
        $user = $this->makeCustomer();
        $user->wallet->update(['balance' => 1]);

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/account/deletion', [
            'reason_code' => 'unused',
            'pin' => '123456',
            'pin_confirmation' => '123456',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'wallet_not_empty');
    }

    public function test_rejects_when_open_transaction_exists(): void
    {
        $user = $this->makeCustomer();

        Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV-OPEN-1',
            'service_name' => 'Pulsa',
            'target_number' => '08123456789',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PENDING_SUPPLIER->value,
            'notes' => 'open',
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/account/deletion', [
            'reason_code' => 'unused',
            'pin' => '123456',
            'pin_confirmation' => '123456',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'open_transactions');
    }

    public function test_rejects_when_pending_withdraw_or_deposit(): void
    {
        $user = $this->makeCustomer();

        WithdrawRequest::create([
            'user_id' => $user->id,
            'amount' => 10000,
            'admin_fee' => 0,
            'method' => 'bank',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/account/deletion', [
            'reason_code' => 'unused',
            'pin' => '123456',
            'pin_confirmation' => '123456',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'open_transactions');

        WithdrawRequest::query()->where('user_id', $user->id)->delete();

        DepositRequest::create([
            'user_id' => $user->id,
            'amount' => 50000,
            'method' => 'manual_transfer',
            'proof_file_url' => 'x.jpg',
            'status' => 'pending',
        ]);

        $this->postJson('/api/v1/account/deletion', [
            'reason_code' => 'unused',
            'pin' => '123456',
            'pin_confirmation' => '123456',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'open_transactions');
    }

    public function test_request_sets_pending_deletion_and_audit(): void
    {
        $user = $this->makeCustomer();
        Sanctum::actingAs($user);

        $res = $this->postJson('/api/v1/account/deletion', [
            'reason_code' => 'privacy',
            'pin' => '123456',
            'pin_confirmation' => '123456',
        ])->assertOk();

        $res->assertJsonPath('data.status', AccountDeletionStatus::PENDING_DELETION->value);

        $user->refresh();
        $this->assertSame(AccountDeletionStatus::PENDING_DELETION->value, $user->deletion_status);
        $this->assertNotNull($user->deletion_scheduled_for);
        $this->assertTrue(
            $user->deletion_scheduled_for->between(now()->addDays(29), now()->addDays(31))
        );
        $this->assertNull($user->deleted_at);

        $this->assertDatabaseHas('account_deletion_events', [
            'user_id' => $user->id,
            'event' => AccountDeletionEvent::EVENT_REQUESTED,
        ]);
    }

    public function test_pending_deletion_blocks_money_routes(): void
    {
        $user = $this->makeCustomer();
        $user->forceFill([
            'deletion_status' => AccountDeletionStatus::PENDING_DELETION->value,
            'deletion_requested_at' => now(),
            'deletion_scheduled_for' => now()->addDays(30),
        ])->save();

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/wallet/transfer', [
            'recipient_wallet_number' => 'W0000000001',
            'amount' => 1000,
            'pin' => '123456',
            'idempotency_key' => 'k1',
        ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'account_pending_deletion');

        $this->postJson('/api/v1/wallet/topup', [
            'amount' => 10000,
            'topup_method' => 'qris',
            'idempotency_key' => 'k2',
        ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'account_pending_deletion');

        $this->postJson('/api/v1/transactions', [
            'sku_code' => 'TSEL5',
            'target_number' => '08123456789',
            'pin' => '123456',
            'idempotency_key' => 'k3',
        ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'account_pending_deletion');

        // Login / me still works
        $this->getJson('/api/v1/auth/me')->assertOk();
        $this->getJson('/api/v1/account/deletion')
            ->assertOk()
            ->assertJsonPath('data.status', AccountDeletionStatus::PENDING_DELETION->value);
    }

    public function test_cancel_with_pin_restores_active(): void
    {
        $user = $this->makeCustomer();
        $user->forceFill([
            'deletion_status' => AccountDeletionStatus::PENDING_DELETION->value,
            'deletion_requested_at' => now(),
            'deletion_scheduled_for' => now()->addDays(30),
            'deletion_reason_code' => 'unused',
        ])->save();

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/account/deletion/cancel', [
            'pin' => '123456',
        ])->assertOk();

        $user->refresh();
        $this->assertNull($user->deletion_status);
        $this->assertNotNull($user->deletion_cancelled_at);

        $this->assertDatabaseHas('account_deletion_events', [
            'user_id' => $user->id,
            'event' => AccountDeletionEvent::EVENT_CANCELLED,
        ]);

        // Money routes no longer blocked by deletion middleware (may fail for other reasons)
        $blocked = $this->postJson('/api/v1/wallet/topup', [
            'amount' => 10000,
            'topup_method' => 'qris',
            'idempotency_key' => 'k-after-cancel',
        ]);
        $this->assertNotSame('account_pending_deletion', $blocked->json('code'));
    }

    public function test_purge_job_anonymizes_keeps_transactions_and_is_idempotent(): void
    {
        Mail::fake();
        $user = $this->makeCustomer([
            'email' => 'keep-me-free@example.com',
            'phone_number' => '081111111111',
            'google_id' => 'google-abc',
        ]);
        $originalEmail = $user->email;
        $originalPhone = $user->phone_number;

        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV-KEEP-1',
            'service_name' => 'Pulsa',
            'target_number' => '08123456789',
            'amount' => 5000,
            'admin_fee' => 0,
            'total_payment' => 5000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
            'notes' => 'done',
        ]);

        $user->forceFill([
            'deletion_status' => AccountDeletionStatus::PENDING_DELETION->value,
            'deletion_requested_at' => now()->subDays(31),
            'deletion_scheduled_for' => now()->subDay(),
            'deletion_reason_code' => 'unused',
        ])->save();

        $service = app(AccountDeletionService::class);
        $this->assertTrue($service->purgeIfDue($user->fresh()));

        $purged = User::withTrashed()->find($user->id);
        $this->assertNotNull($purged->deleted_at);
        $this->assertSame(AccountDeletionStatus::PURGED->value, $purged->deletion_status);
        $this->assertNotSame($originalEmail, $purged->email);
        $this->assertNotSame($originalPhone, $purged->phone_number);
        $this->assertNull($purged->google_id);
        $this->assertNull($purged->transaction_pin);

        $tx->refresh();
        $this->assertSame($user->id, $tx->user_id);
        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->status);

        $this->assertDatabaseHas('account_deletion_events', [
            'user_id' => $user->id,
            'event' => AccountDeletionEvent::EVENT_EXECUTED,
        ]);

        // Idempotent second run
        $this->assertFalse($service->purgeIfDue($purged->fresh()));
        $this->assertSame(
            1,
            AccountDeletionEvent::query()
                ->where('user_id', $user->id)
                ->where('event', AccountDeletionEvent::EVENT_EXECUTED)
                ->count()
        );

        // Freed email/phone can register again (unique constraint)
        $newUser = User::create([
            'name' => 'New Owner',
            'email' => $originalEmail,
            'phone_number' => $originalPhone,
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('654321'),
            'email_verified_at' => now(),
        ]);
        $this->assertNotSame($user->id, $newUser->id);
    }

    public function test_reminders_sent_once_per_stage(): void
    {
        Mail::fake();
        $user = $this->makeCustomer();
        $user->forceFill([
            'deletion_status' => AccountDeletionStatus::PENDING_DELETION->value,
            'deletion_requested_at' => now()->subDays(23),
            'deletion_scheduled_for' => now()->addDays(7)->subHour(),
            'deletion_reason_code' => 'unused',
        ])->save();

        $service = app(AccountDeletionService::class);
        $first = $service->sendDueReminders();
        $this->assertSame(1, $first['h7']);
        $user->refresh();
        $this->assertNotNull($user->deletion_reminder_h7_sent_at);

        $second = $service->sendDueReminders();
        $this->assertSame(0, $second['h7']);

        $user->forceFill([
            'deletion_scheduled_for' => now()->addHours(12),
            'deletion_reminder_h1_sent_at' => null,
        ])->save();

        $h1 = $service->sendDueReminders();
        $this->assertSame(1, $h1['h1']);
        $again = $service->sendDueReminders();
        $this->assertSame(0, $again['h1']);
    }

    public function test_staff_role_rejected(): void
    {
        $staff = $this->makeStaff();
        Sanctum::actingAs($staff);

        $this->postJson('/api/v1/account/deletion', [
            'reason_code' => 'unused',
            'pin' => '123456',
            'pin_confirmation' => '123456',
        ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'role_not_allowed');
    }

    public function test_artisan_process_command_runs(): void
    {
        $user = $this->makeCustomer();
        $user->forceFill([
            'deletion_status' => AccountDeletionStatus::PENDING_DELETION->value,
            'deletion_requested_at' => now()->subDays(40),
            'deletion_scheduled_for' => now()->subDay(),
            'deletion_reason_code' => 'unused',
        ])->save();

        Artisan::call('accounts:process-pending-deletions');
        $this->assertNotNull(User::withTrashed()->find($user->id)?->deleted_at);
    }
}
