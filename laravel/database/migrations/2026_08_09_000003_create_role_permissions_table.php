<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.2 — Sprint 1 (Skema Basis Data Inti).
// Tabel junction many-to-many roles <-> permissions.
// role_id/permission_id: ON DELETE CASCADE (ENGINEERING DECISION — baris junction tidak
// bermakna tanpa induknya, bukan data historis/finansial, aman untuk cascade).
return new class extends Migration {
    public function up(): void
    {
        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->foreignId('permission_id')->constrained('permissions')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['role_id', 'permission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
    }
};
