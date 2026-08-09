<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * SRS Bagian 7.1 — Sprint 2 (Authentication & RBAC), keputusan #4 & #5.
 *
 * Backfill IDEMPOTENT untuk kolom `user_type` & `role_id` pada `users`
 * (kolom sudah ada sejak migration Sprint 1, additive, nullable). Aman
 * dijalankan berulang kali:
 *
 *  - Staf (role != user): `role_id` disinkronkan ke `roles.id` yang cocok
 *    dengan role existing-nya (hanya di-update jika berbeda dari nilai saat
 *    ini — no-op jika sudah benar). `user_type` diisi 'staff' HANYA jika
 *    kolomnya masih kosong (tidak menimpa nilai yang sudah ada).
 *  - Customer/User (role == user): `role_id` TIDAK PERNAH disentuh — harus
 *    tetap null sesuai keputusan #5. `user_type` diisi HANYA jika masih
 *    kosong: 'agent' jika `agent_level` sudah terisi (bukti data valid),
 *    selain itu 'customer'. Tidak pernah mengarang/mengasumsikan agent
 *    tanpa bukti (keputusan #4).
 *
 * WAJIB dijalankan setelah RoleSeeder (butuh `roles` sudah terisi untuk
 * resolusi role_id). Soft-deleted users otomatis dikecualikan (default
 * Eloquent query scope pada model User yang memakai SoftDeletes).
 */
class UserRbacBackfillSeeder extends Seeder
{
    public function run(): void
    {
        $roleIdByLabel = Role::query()->pluck('id', 'name');
        $updated = 0;
        $scanned = 0;

        User::query()->orderBy('id')->chunkById(200, function ($users) use ($roleIdByLabel, &$updated, &$scanned) {
            foreach ($users as $user) {
                $scanned++;
                $role = $user->role instanceof UserRole ? $user->role : UserRole::tryFrom((string) $user->role);
                $dirty = false;

                if ($role === null || $role === UserRole::USER) {
                    // Customer/agen — role_id sengaja TIDAK disentuh (keputusan #5).
                    if (empty($user->user_type)) {
                        $user->user_type = !empty($user->agent_level) ? 'agent' : 'customer';
                        $dirty = true;
                    }
                } else {
                    // Staf — role_id disinkronkan ke roles.id sesuai role existing.
                    $targetRoleId = $roleIdByLabel[$role->label()] ?? null;

                    if ($targetRoleId !== null && $user->role_id !== $targetRoleId) {
                        $user->role_id = $targetRoleId;
                        $dirty = true;
                    }

                    if (empty($user->user_type)) {
                        $user->user_type = 'staff';
                        $dirty = true;
                    }
                }

                if ($dirty) {
                    $user->saveQuietly();
                    $updated++;
                }
            }
        });

        $this->command?->info("UserRbacBackfillSeeder: {$scanned} user diperiksa, {$updated} diperbarui.");
    }
}
