<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * SRS Bagian 7.2 & Bagian 2.3 — Sprint 2 (Authentication & RBAC), keputusan #5.
 *
 * Bagian 7.2 menyebut roles.id sebagai "Identitas role (Owner, Marketing,
 * Operasional, Finance, CS)" — 5 role. Super Admin/IT (Bagian 2.3, opsional)
 * DISERTAKAN di sini karena keputusan Sprint 2 #5 mewajibkan backfill role_id
 * untuk SEMUA staf (role != user), dan Super Admin adalah role staf teknis.
 *
 * `role = user` (customer/agent) TIDAK mendapat baris `roles` — role_id
 * mereka sengaja tetap null (Bagian 7.1: role_id hanya untuk user_type='staff').
 *
 * Nama role disamakan dengan UserRole::label() agar backfill (role_id) dan
 * seeding relasi (RolePermissionSeeder) punya satu sumber kebenaran yang sama
 * (enum), bukan string literal yang bisa drift.
 *
 * Idempotent: firstOrCreate berdasarkan `name`, aman dijalankan berulang.
 */
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (UserRole::cases() as $role) {
            if ($role === UserRole::USER) {
                // Customer/end-user bukan bagian dari skema RBAC staf (Bagian 7.1).
                continue;
            }

            Role::firstOrCreate(['name' => $role->label()]);
        }
    }
}
