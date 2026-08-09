<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SRS Bagian 7.6 — Sprint 1 (Skema Basis Data Inti).
// Tabel baru sesuai SRS 7.6. `wallet_histories` TIDAK di-rename/drop, ENUM
// App\Enums\WalletHistoryType (credit/debit) TIDAK diubah, Actions/Wallet/* TIDAK disentuh,
// dan TIDAK ada dual-write pada migration ini.
return new class extends Migration {
    public function up(): void
    {
        Schema::create('wallet_mutations', function (Blueprint $table) {
            $table->id();

            // ENGINEERING COMPATIBILITY FIELD — wallet_id TIDAK eksplisit disebut di SRS 7.6,
            // tetapi diperlukan agar setiap mutation dapat terhubung ke wallet pemiliknya.
            // ON DELETE RESTRICT (ENGINEERING DECISION — data mutasi bersifat finansial/
            // historis, tidak boleh cascade-delete saat wallet induk dihapus).
            $table->foreignId('wallet_id')->constrained('wallets')->onDelete('restrict');

            $table->enum('type', ['topup', 'purchase', 'refund', 'withdraw', 'adjustment']);
            $table->decimal('amount', 15, 2);

            // Nullable (ENGINEERING DECISION) — mutasi bertipe 'adjustment' dapat terjadi
            // tanpa referensi ke transaksi/deposit/withdraw request tertentu.
            $table->string('reference_id', 255)->nullable();

            // approved_by: ON DELETE SET NULL (ENGINEERING DECISION — relasi opsional).
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_mutations');
    }
};
