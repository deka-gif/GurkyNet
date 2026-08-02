<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => Hash::make('password123'),
            'phone_number' => '08' . $this->faker->unique()->numerify('##########'),
            'role' => \App\Enums\UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
            'remember_token' => Str::random(10),
        ];
    }

    public function superAdmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => \App\Enums\UserRole::SUPER_ADMIN,
        ]);
    }

    public function owner(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => \App\Enums\UserRole::OWNER,
        ]);
    }

    public function finance(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => \App\Enums\UserRole::FINANCE,
        ]);
    }

    public function operations(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => \App\Enums\UserRole::OPERATIONS,
        ]);
    }

    public function marketing(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => \App\Enums\UserRole::MARKETING,
        ]);
    }

    public function customerSupport(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => \App\Enums\UserRole::CUSTOMER_SUPPORT,
        ]);
    }
}
