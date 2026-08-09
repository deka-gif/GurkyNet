<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * SRS Bagian 5 (Matriks Hak Akses) — Sprint 2 (Authentication & RBAC), keputusan #6.
 *
 * Relasi role<->permission PERSIS mengikuti Matriks Bagian 5: setiap simbol
 * selain '-' (Penuh/Lihat/Request) menghasilkan satu baris relasi di
 * `role_permissions`. Skema Sprint 1 untuk `role_permissions` hanya berupa
 * relasi many-to-many boolean (tidak ada kolom level akses), sehingga
 * pembedaan Penuh vs Lihat/Request DITEGAKKAN DI KODE (route middleware —
 * lihat EnsureRole & EnsureOwnerReadOnly), bukan di tabel ini. Tabel ini
 * merepresentasikan "role X punya akses ke modul Y", sesuai literal SRS 7.2.
 *
 * Super Admin TIDAK muncul di Matriks Bagian 5 (bukan salah satu dari 5 kolom
 * role) sehingga TIDAK diberi baris relasi di sini — aksesnya penuh melalui
 * bypass eksplisit di EnsureRole, bukan lewat tabel ini. Menghindari
 * mengarang relasi yang tidak disebut SRS.
 *
 * Idempotent: syncWithoutDetaching hanya menambah, tidak pernah menghapus,
 * aman dijalankan berulang.
 */
class RolePermissionSeeder extends Seeder
{
    /**
     * Permission name => daftar nama role (UserRole::label()) yang punya
     * relasi (simbol apa pun kecuali '-') pada baris Matriks Bagian 5 tersebut.
     *
     * @var array<string, list<string>>
     */
    public const MATRIX = [
        'Profil Perusahaan & Identitas' => ['Marketing', 'Owner'],
        'Banner & Konten Promosi' => ['Marketing', 'Owner'],
        'Notifikasi Kampanye/Push' => ['Marketing', 'Customer Support', 'Owner'],
        'Master Produk & Kategori' => ['Operations', 'Finance', 'Customer Support', 'Owner'],
        // Sprint 2 Revision — Finding 2: SRS Bagian 5 baris "Harga Jual &
        // Markup" = Finance "Lihat" (bukan '-'), sebelumnya hilang dari peta.
        'Harga Jual & Markup' => ['Operations', 'Finance', 'Owner'],
        'Koneksi Supplier (H2H)' => ['Operations', 'Owner'],
        'Saldo & Mutasi Pengguna' => ['Finance', 'Customer Support', 'Owner'],
        'Approval Deposit Manual' => ['Finance', 'Owner'],
        'Approval Withdraw' => ['Finance', 'Owner'],
        'Laporan Keuangan' => ['Finance', 'Owner'],
        'Live Chat / Tiket Komplain' => ['Operations', 'Finance', 'Customer Support', 'Owner'],
        'FAQ & Pusat Bantuan' => ['Customer Support', 'Owner'],
        'Riwayat Transaksi Pengguna' => ['Operations', 'Finance', 'Customer Support', 'Owner'],
        'Audit Log Lintas Divisi' => ['Owner'],
    ];

    public function run(): void
    {
        foreach (self::MATRIX as $permissionName => $roleLabels) {
            $permission = Permission::where('name', $permissionName)->first();

            if (!$permission) {
                continue;
            }

            foreach ($roleLabels as $roleLabel) {
                $role = Role::where('name', $roleLabel)->first();

                if (!$role) {
                    continue;
                }

                $role->permissions()->syncWithoutDetaching([$permission->id]);
            }
        }
    }
}
