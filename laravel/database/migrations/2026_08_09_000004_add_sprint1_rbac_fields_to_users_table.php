<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.1 & 7.2 — Sprint 1 (Skema Basis Data Inti).
// Migration ADDITIVE murni: menambah kolom yang belum ada di `users` tanpa menyentuh
// `role`, enum App\Enums\UserRole, atau middleware EnsureRole.
// role_id: nullable — existing users belum dimigrasikan ke RBAC database-driven
// (ENGINEERING DECISION, ditegaskan sesuai keputusan audit Sprint 1). Tidak ada backfill
// data dan tidak ada aktivasi perilaku RBAC baru pada migration ini.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'user_type')) {
                $table->string('user_type', 255)->nullable();
            }
        });

        if (!Schema::hasColumn('users', 'role_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('role_id')->nullable()->constrained('roles')->onDelete('set null');
            });
        }

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'agent_level')) {
                $table->string('agent_level', 255)->nullable();
            }
            if (!Schema::hasColumn('users', 'status')) {
                $table->string('status', 255)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'role_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropForeign(['role_id']);
            });
        }

        Schema::table('users', function (Blueprint $table) {
            foreach (['status', 'agent_level', 'role_id', 'user_type'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
