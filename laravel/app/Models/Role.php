<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * SRS Bagian 7.2 (Skema `roles`/`permissions`) — Sprint 1 menyediakan skema,
 * Sprint 2 (Authentication & RBAC) mulai mengisi & memodelkan data-nya.
 *
 * Model ini adalah lapisan data kanonis RBAC database-driven. Otorisasi
 * runtime SAAT INI tetap ditegakkan oleh `users.role` + `EnsureRole`
 * (lihat Sprint 2 Compatibility Strategy) — tabel ini belum menjadi sumber
 * keputusan izin di middleware manapun pada Sprint 2.
 */
class Role extends Model
{
    protected $fillable = [
        'name',
    ];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permissions')->withTimestamps();
    }

    /**
     * Staf (user_type = 'staff') yang role_id-nya menunjuk ke role ini.
     * Bagian 7.1 — role_id hanya terisi untuk user_type = 'staff'.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id');
    }
}
