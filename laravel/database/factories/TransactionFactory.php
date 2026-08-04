<?php

namespace Database\Factories;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    public function definition(): array
    {
        $faker = $this->faker ?? (function_exists('fake') ? fake() : null);
        $amount = $faker ? $faker->randomElement([10000, 25000, 50000, 100000, 200000]) : 50000;
        $adminFee = $faker ? $faker->randomElement([0, 1500, 2500]) : 1000;
        $invoiceSuffix = $faker ? $faker->unique()->numerify('####') : mt_rand(1000, 9999);
        $service = $faker ? $faker->randomElement(['Pulsa', 'Paket Data', 'Token PLN', 'Voucher', 'Transfer Saldo']) : 'Pulsa';
        $targetNumber = $faker ? $faker->numerify('08##########') : ('08' . mt_rand(1000000000, 9999999999));
        $status = $faker ? $faker->randomElement(['sukses', 'pending', 'gagal']) : 'sukses';
        $notes = $faker ? $faker->sentence() : 'Transaksi pembayaran instan';

        return [
            'user_id' => User::factory(),
            'invoice_number' => 'TRX-' . now()->format('YmdHis') . '-' . $invoiceSuffix,
            'service_name' => $service,
            'target_number' => $targetNumber,
            'amount' => $amount,
            'admin_fee' => $adminFee,
            'total_payment' => $amount + $adminFee,
            'payment_method' => 'wallet',
            'status' => $status,
            'notes' => $notes,
        ];
    }
}
