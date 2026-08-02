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
        return [
            'user_id' => User::factory(),
            'wallet_number' => $this->faker->unique()->numerify('1042##########'),
            'balance' => $this->faker->randomFloat(2, 50000, 5000000), // Random balance between 50k and 5 million
            'status' => 'active',
        ];
    }
}
