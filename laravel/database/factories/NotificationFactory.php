<?php

namespace Database\Factories;

use App\Models\Notification;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    public function definition(): array
    {
        $faker = $this->faker ?? (function_exists('fake') ? fake() : null);
        $title = $faker ? $faker->sentence(4) : ('Notification ' . Str::random(8));
        $message = $faker ? $faker->paragraph(2) : 'Pemberitahuan sistem informasi transaksi akun Anda.';
        $type = $faker ? $faker->randomElement(['broadcast', 'transaction', 'system']) : 'broadcast';

        return [
            'title' => $title,
            'message' => $message,
            'type' => $type,
        ];
    }
}
