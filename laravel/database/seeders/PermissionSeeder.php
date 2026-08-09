<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

/**
 * SRS Bagian 5 (Matriks Hak Akses) — Sprint 2 (Authentication & RBAC), keputusan #6.
 *
 * TEPAT 14 permission, diturunkan 1:1 dari 14 baris Matriks Bagian 5 (kolom
 * "Modul / Fitur"). TIDAK ADA permission tambahan di luar daftar ini, dan
 * nama tidak diubah dari yang tertulis di SRS.
 *
 * Idempotent: firstOrCreate berdasarkan `name`, aman dijalankan berulang.
 */
class PermissionSeeder extends Seeder
{
    /**
     * Urutan & nama PERSIS sesuai baris Matriks Hak Akses Bagian 5 SRS.
     *
     * @var list<string>
     */
    public const PERMISSIONS = [
        'Profil Perusahaan & Identitas',
        'Banner & Konten Promosi',
        'Notifikasi Kampanye/Push',
        'Master Produk & Kategori',
        'Harga Jual & Markup',
        'Koneksi Supplier (H2H)',
        'Saldo & Mutasi Pengguna',
        'Approval Deposit Manual',
        'Approval Withdraw',
        'Laporan Keuangan',
        'Live Chat / Tiket Komplain',
        'FAQ & Pusat Bantuan',
        'Riwayat Transaksi Pengguna',
        'Audit Log Lintas Divisi',
    ];

    public function run(): void
    {
        foreach (self::PERMISSIONS as $name) {
            Permission::firstOrCreate(['name' => $name]);
        }
    }
}
