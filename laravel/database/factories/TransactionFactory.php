<?php

namespace Database\Factories;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    public function definition(): array
    {
        $amount = $this->faker->randomElement([10000, 25000, 50000, 100000, 200000]);
        $adminFee = $this->faker->randomElement([0, 1500, 2500]);
        
        return [
            'user_id' => User::factory(),
            'invoice_number' => 'TRX-' . now()->format('YmdHis') . '-' . $this->faker->unique()->numerify('####'),
            'service_name' => $this->faker->randomElement(['Pulsa', 'Paket Data', 'Token PLN', 'Voucher', 'Transfer Saldo']),
            'target_number' => $this->faker->numerify('08##########'),
            'amount' => $amount,
            'admin_fee' => $adminFee,
            'total_payment' => $amount + $adminFee,
            'payment_method' => 'wallet',
            'status' => $this->faker->randomElement(['sukses', 'pending', 'gagal']),
            'notes' => $this->faker->sentence(),
        ];
    }
}
