<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * SRS Bagian 7.2 & Bagian 5 (Matriks Hak Akses) — Sprint 2 (Authentication & RBAC).
 * HANYA 14 permission yang berasal 1:1 dari 14 baris Matriks Bagian 5 boleh ada
 * (lihat Database\Seeders\PermissionSeeder). Jangan menambah permission baru
 * di luar daftar tersebut tanpa perubahan SRS.
 */
class Permission extends Model
{
    protected $fillable = [
        'name',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_permissions')->withTimestamps();
    }
}
