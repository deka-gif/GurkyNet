<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.10 — Sprint 1 (Skema Basis Data Inti).
// Tabel canonical baru sesuai SRS, berjalan PARALEL dengan `activity_logs` existing.
// `activity_logs`, model ActivityLog, dan listener WriteAuditLog TIDAK disentuh.
// TIDAK ada dual-write pada migration ini — integrasi setiap modul ke audit_logs adalah
// scope sprint modul masing-masing dan diverifikasi di Sprint 7.
// Hanya `created_at` (tanpa updated_at) sesuai field yang eksplisit disebut SRS 7.10 —
// audit log bersifat append-only/immutable (Bagian 2.4), selaras dengan tidak adanya
// mekanisme update pada baris audit log.
// actor_id: ON DELETE SET NULL (ENGINEERING DECISION — audit trail harus tetap ada meski
// akun aktor dihapus; tidak boleh cascade-delete riwayat audit, dan tidak memakai RESTRICT
// agar penghapusan akun user tidak terhalang oleh riwayat audit-nya).
return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('actor_role', 255)->nullable();
            $table->string('action', 255);
            $table->string('entity_type', 255)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('old_value')->nullable();
            $table->json('new_value')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
