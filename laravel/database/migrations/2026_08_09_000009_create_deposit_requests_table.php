<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.7 — Sprint 1 (Skema Basis Data Inti).
// Tabel baru murni. TIDAK ada integrasi business logic (payment_histories,
// midtrans_transactions, dan Actions/Wallet/* tidak disentuh) — integrasi workflow
// deposit adalah scope Sprint 4 / Sprint 11.
// user_id: ON DELETE RESTRICT (ENGINEERING DECISION — data pengajuan finansial, tidak
// boleh cascade-delete saat user dihapus).
// reviewed_by: ON DELETE SET NULL (ENGINEERING DECISION — relasi opsional ke staf reviewer).
return new class extends Migration {
    public function up(): void
    {
        Schema::create('deposit_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict');
            $table->decimal('amount', 15, 2);
            $table->enum('method', ['manual_transfer', 'va', 'qris']);
            $table->string('proof_file_url', 255)->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'on_hold']);
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deposit_requests');
    }
};
