<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class ResetStaffPasswords extends Command
{
    protected $signature = 'gurkynet:reset-staff-passwords';
    protected $description = 'Reset password 6 akun divisi (admin/owner/finance/operations/marketing/cs) ke password baru. Aman dijalankan berkali-kali, HANYA update kolom password untuk email yang cocok, tidak menyentuh data lain.';

    /**
     * Password harus identik dengan yang ada di DatabaseSeeder.php
     * (bagian $usersData) supaya tidak drift antara dua sumber ini.
     */
    protected array $passwords = [
        'admin@gurkypay.com' => '$xngCc07om9itb',
        'owner@gurkypay.com' => 'ExT7XW2oYJ$hKo',
        'finance@gurkypay.com' => 'vHxBJb9mdK!3nz',
        'operations@gurkypay.com' => 'SrJs%Lg42ba3d2',
        'marketing@gurkypay.com' => 'PvkoN!XxRvjjD7',
        'cs@gurkypay.com' => 'BozHwVZQJ!8e2J',
    ];

    public function handle(): int
    {
        foreach ($this->passwords as $email => $plainPassword) {
            $user = User::where('email', $email)->first();

            if (!$user) {
                $this->warn("Dilewati (akun tidak ditemukan): {$email}");
                continue;
            }

            $user->forceFill(['password' => Hash::make($plainPassword)])->save();
            $this->info("Password diperbarui: {$email}");
        }

        $this->info('Selesai. Password lama sudah tidak berlaku lagi untuk 6 akun di atas.');

        return self::SUCCESS;
    }
}
