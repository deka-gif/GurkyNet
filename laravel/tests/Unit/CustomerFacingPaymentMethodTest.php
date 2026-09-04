<?php

namespace Tests\Unit;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\MidtransTransaction;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Support\Payments\CustomerFacingPaymentMethod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * FR-TOPUP-UX-03 — customer-facing payment method labels from stored channel data.
 */
class CustomerFacingPaymentMethodTest extends TestCase
{
    use RefreshDatabase;

    protected function makeTopUp(array $txOverrides = [], array $mtOverrides = []): Transaction
    {
        $user = User::create([
            'name' => 'Label User',
            'email' => 'label-'.uniqid('', true).'@gurkynet.test',
            'phone_number' => '0812'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
        ]);
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => 'W'.random_int(10000, 99999),
            'balance' => 0,
            'status' => 'active',
        ]);

        $tx = Transaction::create(array_merge([
            'user_id' => $user->id,
            'invoice_number' => 'TRX-TOPUP-LABEL-'.uniqid(),
            'service_name' => 'Top Up Saldo',
            'target_number' => $wallet->wallet_number,
            'amount' => 15000,
            'admin_fee' => 0,
            'total_payment' => 15000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::PENDING->value,
            'notes' => 'Top up saldo via Midtrans (qris/qris)',
        ], $txOverrides));

        MidtransTransaction::create(array_merge([
            'transaction_id' => $tx->id,
            'order_id' => $tx->invoice_number,
            'snap_token' => 'tok',
            'gross_amount' => 15000,
            'transaction_status' => 'pending',
            'payment_type' => 'qris',
        ], $mtOverrides));

        return $tx->fresh(['midtransTransaction']);
    }

    public function test_qris_label(): void
    {
        $tx = $this->makeTopUp();
        $this->assertSame('QRIS', CustomerFacingPaymentMethod::labelFor($tx));
    }

    public function test_va_bri_and_bca_from_notes(): void
    {
        $bri = $this->makeTopUp(['notes' => 'Top up saldo via Midtrans (va/bri_va)'], ['payment_type' => 'bri_va']);
        $this->assertSame('Virtual Account BRI', CustomerFacingPaymentMethod::labelFor($bri));

        $bca = $this->makeTopUp(['notes' => 'Top up saldo via Midtrans (va/bca_va)'], ['payment_type' => 'bca_va']);
        $this->assertSame('Virtual Account BCA', CustomerFacingPaymentMethod::labelFor($bca));
    }

    public function test_indomaret_and_gopay_from_core_api_shape(): void
    {
        $indo = $this->makeTopUp(
            ['notes' => 'no channel'],
            [
                'payment_type' => 'cstore',
                'raw_notification' => ['store' => 'indomaret', 'payment_type' => 'cstore'],
            ]
        );
        $this->assertSame('Indomaret', CustomerFacingPaymentMethod::labelFor($indo));

        $gopay = $this->makeTopUp(
            ['notes' => 'no channel'],
            ['payment_type' => 'gopay', 'raw_notification' => ['payment_type' => 'gopay']]
        );
        $this->assertSame('GoPay', CustomerFacingPaymentMethod::labelFor($gopay));
    }

    public function test_bank_transfer_uses_bank_from_raw_notification(): void
    {
        $tx = $this->makeTopUp(
            ['notes' => 'no channel'],
            [
                'payment_type' => 'bank_transfer',
                'raw_notification' => [
                    'payment_type' => 'bank_transfer',
                    'va_numbers' => [['bank' => 'bni', 'va_number' => '123']],
                ],
            ]
        );
        $this->assertSame('Virtual Account BNI', CustomerFacingPaymentMethod::labelFor($tx));
    }

    public function test_never_returns_midtrans(): void
    {
        $tx = $this->makeTopUp(
            ['notes' => null],
            ['payment_type' => null, 'raw_notification' => null]
        );
        $label = CustomerFacingPaymentMethod::labelFor($tx);
        $this->assertSame('Pembayaran', $label);
        $this->assertStringNotContainsStringIgnoringCase('midtrans', $label);
    }
}
