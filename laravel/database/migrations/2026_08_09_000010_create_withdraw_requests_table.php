<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.7 — Sprint 1 (Skema Basis Data Inti).
// Tabel baru murni. TIDAK menyentuh Actions/Wallet/WithdrawWalletAction.php — integrasi
// workflow withdraw adalah scope Sprint 4 / Sprint 11.
// user_id: ON DELETE RESTRICT (ENGINEERING DECISION — data pengajuan finansial).
// reviewed_by: ON DELETE SET NULL (ENGINEERING DECISION — relasi opsional ke staf reviewer).
// proof_file_url disertakan agar struktur konsisten dengan deposit_requests (SRS 7.7
// menjelaskan deposit & withdraw_requests sebagai pasangan dengan struktur serupa).
return new class extends Migration {
    public function up(): void
    {
        Schema::create('withdraw_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict');
            $table->decimal('amount', 15, 2);
            $table->enum('method', ['bank_transfer']);
            $table->string('proof_file_url', 255)->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'on_hold']);
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdraw_requests');
    }
};
