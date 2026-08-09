<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.2 — Sprint 1 (Skema Basis Data Inti).
// Menyediakan skema RBAC database-driven. TIDAK mengaktifkan perilaku RBAC baru —
// `users.role`, enum UserRole, dan middleware EnsureRole tetap berjalan seperti sebelumnya.
// Migrasi perilaku RBAC ke tabel ini adalah scope Sprint 2.
return new class extends Migration {
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
