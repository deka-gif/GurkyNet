<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Database\Eloquent\Factories\Factory;

class WalletFactory extends Factory
{
    protected $model = Wallet::class;

    public function definition(): array
    {
        $faker = $this->faker ?? (function_exists('fake') ? fake() : null);
        $walletNumber = $faker ? $faker->unique()->numerify('1042##########') : ('1042' . mt_rand(1000000000, 9999999999));
        $balance = $faker ? $faker->randomFloat(2, 50000, 5000000) : (mt_rand(500, 50000) * 100);

        return [
            'user_id' => User::factory(),
            'wallet_number' => $walletNumber,
            'balance' => $balance,
            'status' => 'active',
        ];
    }
}
