<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class DemoUserSeeder extends Seeder
{
    /**
     * Run the database seeds for development demo accounts.
     *
     * @return void
     */
    public function run()
    {
        $password = Hash::make('Dev123456!');

        $demoUsers = [
            [
                'name' => 'Super Admin GurkyNet',
                'email' => 'admin@gurkynet.my.id',
                'password' => $password,
                'role' => 'Super Admin',
                'phone' => '+628110000001',
            ],
            [
                'name' => 'Customer Support Staff',
                'email' => 'cs@gurkynet.my.id',
                'password' => $password,
                'role' => 'Customer Support',
                'phone' => '+628110000002',
            ],
            [
                'name' => 'Finance Manager',
                'email' => 'finance@gurkynet.my.id',
                'password' => $password,
                'role' => 'Finance',
                'phone' => '+628110000003',
            ],
            [
                'name' => 'Operations Lead',
                'email' => 'ops@gurkynet.my.id',
                'password' => $password,
                'role' => 'Operations',
                'phone' => '+628110000004',
            ],
            [
                'name' => 'Marketing Specialist',
                'email' => 'marketing@gurkynet.my.id',
                'password' => $password,
                'role' => 'Marketing',
                'phone' => '+628110000005',
            ],
            [
                'name' => 'Demo User',
                'email' => 'user@gurkynet.my.id',
                'password' => $password,
                'role' => 'User',
                'phone' => '+628110000006',
            ],
        ];

        foreach ($demoUsers as $userData) {
            User::updateOrCreate(
                ['email' => $userData['email']],
                $userData
            );
        }
    }
}
